//! 폴더 탐색: 지정 폴더의 하위 폴더 + 코믹 아카이브(cbz/cbr/zip) + 이미지 파일을 자연 정렬해 반환한다.
//! 폴더 트리가 아니라 "현재 폴더 한 단계"만 보여주는 평평한 목록이다(폴더 클릭 시 이동).
//! 각 항목의 kind로 프런트가 표시 방법을 정한다(이미지=썸네일, 그 외=시스템 파일 아이콘).

use crate::archive::natural_cmp;
use serde::Serialize;
use std::path::Path;

const ARCHIVE_EXTS: &[&str] = &["cbz", "cbr", "zip"];
const IMAGE_EXTS: &[&str] = &["jpg", "jpeg", "png", "gif", "webp", "avif", "bmp"];

#[derive(Serialize, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum EntryKind {
    Folder,
    Archive,
    Image,
}

#[derive(Serialize, Debug, PartialEq, Eq)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub kind: EntryKind,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DirListing {
    pub current: String,
    pub parent: Option<String>,
    pub folders: Vec<DirEntry>,
    /// 코믹 아카이브 + 이미지 파일.
    pub files: Vec<DirEntry>,
}

fn ext_of(name: &str) -> Option<String> {
    Path::new(name)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
}

/// 폴더 한 단계의 하위 폴더 + 코믹 아카이브 + 이미지 파일을 자연 정렬해 반환한다.
/// 숨김 항목(.으로 시작)은 제외한다.
pub fn list_dir(dir: &Path) -> std::io::Result<DirListing> {
    let mut folders = Vec::new();
    let mut files = Vec::new();

    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        let path = entry.path().to_string_lossy().into_owned();
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            folders.push(DirEntry {
                name,
                path,
                kind: EntryKind::Folder,
            });
            continue;
        }
        let kind = match ext_of(&name).as_deref() {
            Some(e) if ARCHIVE_EXTS.contains(&e) => EntryKind::Archive,
            Some(e) if IMAGE_EXTS.contains(&e) => EntryKind::Image,
            _ => continue, // 그 외 파일은 제외
        };
        files.push(DirEntry { name, path, kind });
    }

    folders.sort_by(|a, b| natural_cmp(&a.name, &b.name));
    files.sort_by(|a, b| natural_cmp(&a.name, &b.name));

    Ok(DirListing {
        current: dir.to_string_lossy().into_owned(),
        parent: dir.parent().map(|p| p.to_string_lossy().into_owned()),
        folders,
        files,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch() -> std::path::PathBuf {
        let d = std::env::temp_dir().join(format!(
            "pv-fs-test-{}-{:?}",
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
    fn lists_folders_archives_images_with_kind_naturally_sorted_excluding_others() {
        let root = scratch();
        std::fs::create_dir(root.join("10 folder")).unwrap();
        std::fs::create_dir(root.join("2 folder")).unwrap();
        std::fs::create_dir(root.join(".hidden")).unwrap();
        std::fs::write(root.join("2.cbz"), b"x").unwrap();
        std::fs::write(root.join("10.cbr"), b"x").unwrap();
        std::fs::write(root.join("1.zip"), b"x").unwrap();
        std::fs::write(root.join("3.png"), b"x").unwrap(); // 이미지
        std::fs::write(root.join("readme.txt"), b"x").unwrap(); // 제외
        std::fs::write(root.join("movie.mp4"), b"x").unwrap(); // 제외

        let listing = list_dir(&root).unwrap();

        let folder_names: Vec<_> = listing.folders.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(folder_names, vec!["2 folder", "10 folder"]); // 숨김 제외, 자연 정렬
        assert!(listing.folders.iter().all(|e| e.kind == EntryKind::Folder));

        let file_names: Vec<_> = listing.files.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(file_names, vec!["1.zip", "2.cbz", "3.png", "10.cbr"]); // 아카이브+이미지, 자연 정렬

        // kind 태깅 확인
        let kind_of = |n: &str| &listing.files.iter().find(|e| e.name == n).unwrap().kind;
        assert_eq!(kind_of("1.zip"), &EntryKind::Archive);
        assert_eq!(kind_of("2.cbz"), &EntryKind::Archive);
        assert_eq!(kind_of("10.cbr"), &EntryKind::Archive);
        assert_eq!(kind_of("3.png"), &EntryKind::Image);

        assert_eq!(listing.parent, Some(root.parent().unwrap().to_string_lossy().into_owned()));
    }

    #[test]
    fn empty_dir_lists_nothing() {
        let root = scratch();
        let listing = list_dir(&root).unwrap();
        assert!(listing.folders.is_empty());
        assert!(listing.files.is_empty());
    }
}
