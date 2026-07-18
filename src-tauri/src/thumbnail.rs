//! 커버(첫 페이지) 썸네일 생성 + 디스크 캐시.
//! 아카이브 첫 이미지 페이지를 추출→디코드→리사이즈→JPEG로 인코드하고, 경로+mtime 해시로 캐시한다.

use crate::archive;
use std::hash::{Hash, Hasher};
use std::path::Path;

const MAX_DIM: u32 = 240;

/// 아카이브 경로 + 수정시각으로 캐시 파일명을 만든다(파일이 바뀌면 캐시 무효화).
fn cache_key(archive_path: &Path) -> String {
    let mtime = std::fs::metadata(archive_path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    archive_path.hash(&mut hasher);
    mtime.hash(&mut hasher);
    format!("{:016x}.jpg", hasher.finish())
}

/// 커버 썸네일 JPEG 바이트를 반환한다. 캐시가 있으면 즉시 반환, 없으면 생성 후 캐시.
pub fn thumbnail(archive_path: &Path, cache_dir: &Path) -> Result<Vec<u8>, String> {
    let cache_file = cache_dir.join(cache_key(archive_path));
    if let Ok(bytes) = std::fs::read(&cache_file) {
        return Ok(bytes);
    }

    let pages = archive::list_pages(archive_path).map_err(|e| e.to_string())?;
    let first = pages.first().ok_or_else(|| "이미지 없음".to_string())?;
    let raw = archive::read_page(archive_path, first).map_err(|e| e.to_string())?;

    let img = image::load_from_memory(&raw).map_err(|e| e.to_string())?;
    let thumb = img.thumbnail(MAX_DIM, MAX_DIM); // 비율 유지, 최대 변 MAX_DIM, 확대는 안 함

    let mut out = std::io::Cursor::new(Vec::new());
    image::DynamicImage::ImageRgb8(thumb.to_rgb8())
        .write_to(&mut out, image::ImageFormat::Jpeg)
        .map_err(|e| e.to_string())?;
    let bytes = out.into_inner();

    let _ = std::fs::create_dir_all(cache_dir);
    let _ = std::fs::write(&cache_file, &bytes);
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture(name: &str) -> std::path::PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures")
            .join(name)
    }

    fn scratch() -> std::path::PathBuf {
        let d = std::env::temp_dir().join(format!(
            "pv-thumb-test-{}-{:?}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn produces_small_jpeg_and_hits_cache_on_second_call() {
        let cache = scratch();
        let cbr = fixture("sample.cbr");

        let first = thumbnail(&cbr, &cache).unwrap();
        assert_eq!(&first[..2], &[0xFF, 0xD8], "JPEG SOI 매직이어야 함");
        let decoded = image::load_from_memory(&first).unwrap();
        assert!(
            decoded.width() <= MAX_DIM && decoded.height() <= MAX_DIM,
            "썸네일 최대 변은 {MAX_DIM} 이하여야 함"
        );

        // 두 번째 호출은 캐시 히트 → 동일 바이트
        let second = thumbnail(&cbr, &cache).unwrap();
        assert_eq!(first, second);
    }
}
