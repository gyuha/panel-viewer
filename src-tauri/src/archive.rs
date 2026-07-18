//! 코믹 아카이브(cbz/zip = ZIP, cbr = RAR) 읽기.
//!
//! 이미지 항목만 자연 정렬(natural sort)한 페이지 목록과 개별 페이지 바이트 추출을 제공한다.
//! 아카이브 종류는 확장자가 아니라 매직 바이트로 판별하므로 확장자가 틀린 파일(.cbz인데 실제 RAR 등)도 처리한다.

use std::fs::File;
use std::io::Read;
use std::path::Path;

const IMAGE_EXTS: &[&str] = &["jpg", "jpeg", "png", "gif", "webp", "avif", "bmp"];

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum ArchiveKind {
    Zip,
    Rar,
}

/// 아카이브 처리 중 발생하는 오류. Tauri 커맨드 경계에서 문자열로 직렬화된다.
#[derive(Debug)]
pub struct ArchiveError(pub String);

impl std::fmt::Display for ArchiveError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}
impl std::error::Error for ArchiveError {}

impl From<std::io::Error> for ArchiveError {
    fn from(e: std::io::Error) -> Self {
        ArchiveError(format!("io: {e}"))
    }
}
impl From<zip::result::ZipError> for ArchiveError {
    fn from(e: zip::result::ZipError) -> Self {
        ArchiveError(format!("zip: {e}"))
    }
}
impl From<unrar::error::UnrarError> for ArchiveError {
    fn from(e: unrar::error::UnrarError) -> Self {
        ArchiveError(format!("rar: {e}"))
    }
}

impl serde::Serialize for ArchiveError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> std::result::Result<S::Ok, S::Error> {
        s.serialize_str(&self.0)
    }
}

pub type Result<T> = std::result::Result<T, ArchiveError>;

/// 매직 바이트로 아카이브 종류를 판별하고, 실패 시 확장자로 폴백한다.
pub fn detect_kind(path: &Path) -> Result<ArchiveKind> {
    let mut head = [0u8; 8];
    let n = File::open(path)?.read(&mut head)?;
    let head = &head[..n];
    if head.starts_with(b"PK\x03\x04") || head.starts_with(b"PK\x05\x06") {
        return Ok(ArchiveKind::Zip);
    }
    if head.starts_with(b"Rar!\x1a\x07") {
        return Ok(ArchiveKind::Rar);
    }
    match ext_lower(path).as_deref() {
        Some("cbz") | Some("zip") => Ok(ArchiveKind::Zip),
        Some("cbr") | Some("rar") => Ok(ArchiveKind::Rar),
        _ => Err(ArchiveError(format!(
            "지원하지 않는 파일 형식: {}",
            path.display()
        ))),
    }
}

/// 아카이브 안의 이미지 항목명을 자연 정렬해 반환한다(비이미지·디렉터리 제외).
pub fn list_pages(path: &Path) -> Result<Vec<String>> {
    let mut names = match detect_kind(path)? {
        ArchiveKind::Zip => zip_entries(path)?,
        ArchiveKind::Rar => rar_entries(path)?,
    };
    names.retain(|n| is_image(n));
    names.sort_by(|a, b| natural_cmp(a, b));
    Ok(names)
}

/// 지정한 항목의 원본 바이트를 추출한다.
pub fn read_page(path: &Path, entry: &str) -> Result<Vec<u8>> {
    match detect_kind(path)? {
        ArchiveKind::Zip => zip_read(path, entry),
        ArchiveKind::Rar => rar_read(path, entry),
    }
}

fn ext_lower(path: &Path) -> Option<String> {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
}

fn is_image(name: &str) -> bool {
    if name.ends_with('/') {
        return false;
    }
    let ext = Path::new(name)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase());
    matches!(ext, Some(e) if IMAGE_EXTS.contains(&e.as_str()))
}

/// 숫자 부분을 수치로 비교하는 자연 정렬. "2" < "10" 이 되도록 한다. 대소문자 무시.
pub(crate) fn natural_cmp(a: &str, b: &str) -> std::cmp::Ordering {
    use std::cmp::Ordering;
    let mut ai = a.chars().peekable();
    let mut bi = b.chars().peekable();
    loop {
        match (ai.peek().copied(), bi.peek().copied()) {
            (None, None) => return Ordering::Equal,
            (None, Some(_)) => return Ordering::Less,
            (Some(_), None) => return Ordering::Greater,
            (Some(ca), Some(cb)) => {
                if ca.is_ascii_digit() && cb.is_ascii_digit() {
                    let na = take_number(&mut ai);
                    let nb = take_number(&mut bi);
                    match na.cmp(&nb) {
                        Ordering::Equal => continue,
                        ord => return ord,
                    }
                } else {
                    let la = ca.to_ascii_lowercase();
                    let lb = cb.to_ascii_lowercase();
                    match la.cmp(&lb) {
                        Ordering::Equal => {
                            ai.next();
                            bi.next();
                        }
                        ord => return ord,
                    }
                }
            }
        }
    }
}

fn take_number(it: &mut std::iter::Peekable<std::str::Chars>) -> u64 {
    let mut n: u64 = 0;
    while let Some(c) = it.peek().copied() {
        if let Some(d) = c.to_digit(10) {
            n = n.saturating_mul(10).saturating_add(d as u64);
            it.next();
        } else {
            break;
        }
    }
    n
}

fn zip_entries(path: &Path) -> Result<Vec<String>> {
    let mut zip = zip::ZipArchive::new(File::open(path)?)?;
    let mut names = Vec::new();
    for i in 0..zip.len() {
        let f = zip.by_index(i)?;
        if f.is_file() {
            names.push(f.name().to_string());
        }
    }
    Ok(names)
}

fn zip_read(path: &Path, entry: &str) -> Result<Vec<u8>> {
    let mut zip = zip::ZipArchive::new(File::open(path)?)?;
    let mut f = zip.by_name(entry)?;
    let mut buf = Vec::with_capacity(f.size() as usize);
    f.read_to_end(&mut buf)?;
    Ok(buf)
}

fn rar_entries(path: &Path) -> Result<Vec<String>> {
    let mut names = Vec::new();
    for entry in unrar::Archive::new(path).open_for_listing()? {
        let entry = entry?;
        names.push(entry.filename.to_string_lossy().replace('\\', "/"));
    }
    Ok(names)
}

fn rar_read(path: &Path, entry: &str) -> Result<Vec<u8>> {
    let mut archive = unrar::Archive::new(path).open_for_processing()?;
    while let Some(header) = archive.read_header()? {
        let name = header.entry().filename.to_string_lossy().replace('\\', "/");
        if name == entry {
            let (bytes, _rest) = header.read()?;
            return Ok(bytes);
        }
        archive = header.skip()?;
    }
    Err(ArchiveError(format!("항목을 찾을 수 없음: {entry}")))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn fixture(name: &str) -> std::path::PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures")
            .join(name)
    }

    /// 임시 디렉터리에 지정한 (이름, 바이트) 항목들로 ZIP을 만들어 경로를 돌려준다.
    fn make_zip(dir: &Path, filename: &str, entries: &[(&str, &[u8])]) -> std::path::PathBuf {
        let p = dir.join(filename);
        let mut w = zip::ZipWriter::new(File::create(&p).unwrap());
        let opts: zip::write::FileOptions<()> =
            zip::write::FileOptions::default().compression_method(zip::CompressionMethod::Stored);
        for (name, data) in entries {
            w.start_file(*name, opts).unwrap();
            w.write_all(data).unwrap();
        }
        w.finish().unwrap();
        p
    }

    fn tmpdir() -> std::path::PathBuf {
        let d = std::env::temp_dir().join(format!("pv-test-{}", std::process::id()));
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn natural_sort_orders_numbers_numerically() {
        let mut v = vec![
            "10.jpg".to_string(),
            "2.jpg".to_string(),
            "1.jpg".to_string(),
        ];
        v.sort_by(|a, b| natural_cmp(a, b));
        assert_eq!(v, vec!["1.jpg", "2.jpg", "10.jpg"]);
    }

    #[test]
    fn image_filter_rejects_non_images_and_dirs() {
        assert!(is_image("a.JPG"));
        assert!(is_image("path/to/b.webp"));
        assert!(!is_image("note.txt"));
        assert!(!is_image("folder/"));
        assert!(!is_image("noext"));
    }

    #[test]
    fn detect_kind_uses_magic_bytes_over_extension() {
        // 실제 RAR인데 .cbz 확장자여도 Rar로 판별되어야 한다.
        let dir = tmpdir();
        let mislabeled = dir.join("actually_rar.cbz");
        std::fs::copy(fixture("sample.cbr"), &mislabeled).unwrap();
        assert_eq!(detect_kind(&mislabeled).unwrap(), ArchiveKind::Rar);

        let z = make_zip(&dir, "actually_zip.cbr", &[("01.png", b"x")]);
        assert_eq!(detect_kind(&z).unwrap(), ArchiveKind::Zip);
    }

    #[test]
    fn zip_lists_images_in_natural_order_and_extracts_bytes() {
        let dir = tmpdir();
        let p = make_zip(
            &dir,
            "sample.cbz",
            &[
                ("10.png", b"TEN"),
                ("note.txt", b"skip me"),
                ("2.png", b"TWO"),
                ("1.png", b"ONE"),
                ("sub/", b""),
            ],
        );
        let pages = list_pages(&p).unwrap();
        assert_eq!(pages, vec!["1.png", "2.png", "10.png"]);
        assert_eq!(read_page(&p, "1.png").unwrap(), b"ONE");
        assert_eq!(read_page(&p, "10.png").unwrap(), b"TEN");
    }

    #[test]
    fn rar_lists_images_in_natural_order_and_extracts_exact_bytes() {
        let cbr = fixture("sample.cbr");
        let pages = list_pages(&cbr).unwrap();
        // note.txt 는 제외, 자연 정렬
        assert_eq!(pages, vec!["01.png", "02.png", "10.png"]);
        // 추출 바이트가 원본 loose 파일과 정확히 일치해야 한다.
        let expected = std::fs::read(fixture("pages/01.png")).unwrap();
        assert_eq!(read_page(&cbr, "01.png").unwrap(), expected);
        assert!(read_page(&cbr, "10.png").unwrap().starts_with(b"\x89PNG"));
    }

    #[test]
    fn unsupported_file_errors() {
        let dir = tmpdir();
        let p = dir.join("junk.txt");
        std::fs::write(&p, b"hello").unwrap();
        assert!(list_pages(&p).is_err());
    }
}
