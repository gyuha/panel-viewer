//! 폴더 탐색: 지정 폴더의 하위 폴더와 코믹 아카이브(cbz/cbr/zip)를 자연 정렬해 반환한다.
//! 폴더 트리가 아니라 "현재 폴더 한 단계"만 보여주는 평평한 목록이다(폴더 클릭 시 이동).

use crate::archive::natural_cmp;
use serde::Serialize;
use std::path::Path;

const ARCHIVE_EXTS: &[&str] = &["cbz", "cbr", "zip"];

#[derive(Serialize, Debug, PartialEq, Eq)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DirListing {
    pub current: String,
    pub parent: Option<String>,
    pub folders: Vec<DirEntry>,
    /// 코믹 아카이브만.
    pub files: Vec<DirEntry>,
}

fn is_archive(name: &str) -> bool {
    let ext = Path::new(name)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase());
    matches!(ext, Some(e) if ARCHIVE_EXTS.contains(&e.as_str()))
}

/// 폴더 한 단계의 하위 폴더 + 코믹 아카이브를 자연 정렬해 반환한다.
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
            folders.push(DirEntry { name, path });
        } else if is_archive(&name) {
            files.push(DirEntry { name, path });
        }
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
    fn lists_subfolders_and_archives_naturally_sorted_excluding_others() {
        let root = scratch();
        std::fs::create_dir(root.join("10 folder")).unwrap();
        std::fs::create_dir(root.join("2 folder")).unwrap();
        std::fs::create_dir(root.join(".hidden")).unwrap();
        std::fs::write(root.join("2.cbz"), b"x").unwrap();
        std::fs::write(root.join("10.cbr"), b"x").unwrap();
        std::fs::write(root.join("1.zip"), b"x").unwrap();
        std::fs::write(root.join("readme.txt"), b"x").unwrap(); // 제외
        std::fs::write(root.join("movie.mp4"), b"x").unwrap(); // 제외

        let listing = list_dir(&root).unwrap();

        let folder_names: Vec<_> = listing.folders.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(folder_names, vec!["2 folder", "10 folder"]); // 숨김 제외, 자연 정렬

        let file_names: Vec<_> = listing.files.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(file_names, vec!["1.zip", "2.cbz", "10.cbr"]); // 아카이브만, 자연 정렬

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
