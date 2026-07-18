//! 앱 재시작 후에도 복원할 상태를 JSON 파일로 저장/복원한다.
//! 파일별 읽던 위치, 마지막 보기 모드, 마지막으로 탐색한 폴더.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
pub enum ViewMode {
    /// 한 장씩. 구버전의 "ltr"/"rtl" 값은 이 값으로 마이그레이션한다.
    #[default]
    #[serde(rename = "page", alias = "ltr", alias = "rtl")]
    Page,
    #[serde(rename = "continuous")]
    Continuous,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct PersistedState {
    #[serde(default)]
    pub last_folder: Option<String>,
    #[serde(default)]
    pub view_mode: ViewMode,
    /// 아카이브 절대경로 -> 마지막으로 읽은 페이지 인덱스
    #[serde(default)]
    pub reading_positions: HashMap<String, usize>,
    /// 동작 이름 -> 사용자 커스텀 키. 필드가 없으면(구버전) 빈 맵으로 로드되고,
    /// 프런트가 기본값과 병합한다.
    #[serde(default)]
    pub keybindings: HashMap<String, String>,
}

/// 파일에서 상태를 읽는다. 파일이 없거나 깨졌으면 기본값을 돌려준다(뷰어는 절대 죽지 않는다).
pub fn load(path: &Path) -> PersistedState {
    match std::fs::read(path) {
        Ok(bytes) => serde_json::from_slice(&bytes).unwrap_or_default(),
        Err(_) => PersistedState::default(),
    }
}

/// 상태를 파일에 저장한다(상위 디렉터리 자동 생성).
pub fn save(path: &Path, state: &PersistedState) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_vec_pretty(state).expect("PersistedState는 항상 직렬화 가능");
    std::fs::write(path, json)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp_file(name: &str) -> std::path::PathBuf {
        let d = std::env::temp_dir().join(format!("pv-state-test-{}", std::process::id()));
        std::fs::create_dir_all(&d).unwrap();
        d.join(name)
    }

    #[test]
    fn round_trip_preserves_all_fields() {
        let p = tmp_file("round_trip.json");
        let mut s = PersistedState {
            last_folder: Some("/Users/me/comics".into()),
            view_mode: ViewMode::Continuous,
            reading_positions: HashMap::new(),
            keybindings: HashMap::new(),
        };
        s.reading_positions.insert("/a/b.cbz".into(), 37);
        s.reading_positions.insert("/a/c.cbr".into(), 4);
        s.keybindings.insert("nextFile".into(), ".".into());
        s.keybindings.insert("prevFile".into(), ",".into());
        save(&p, &s).unwrap();

        let loaded = load(&p);
        assert_eq!(loaded, s);
        assert_eq!(loaded.view_mode, ViewMode::Continuous);
        assert_eq!(loaded.reading_positions.get("/a/b.cbz"), Some(&37));
        assert_eq!(loaded.keybindings.get("nextFile"), Some(&".".to_string()));
    }

    #[test]
    fn old_json_without_keybindings_loads_empty_map() {
        let p = tmp_file("no_keybindings.json");
        // keybindings 필드가 없는 구버전 상태
        std::fs::write(
            &p,
            br#"{"lastFolder":null,"viewMode":"page","readingPositions":{"/a.cbz":3}}"#,
        )
        .unwrap();
        let loaded = load(&p);
        assert!(loaded.keybindings.is_empty());
        assert_eq!(loaded.reading_positions.get("/a.cbz"), Some(&3));
    }

    #[test]
    fn load_missing_file_returns_default() {
        let p = tmp_file("does-not-exist.json");
        let _ = std::fs::remove_file(&p);
        let s = load(&p);
        assert_eq!(s, PersistedState::default());
        assert_eq!(s.view_mode, ViewMode::Page);
        assert!(s.reading_positions.is_empty());
    }

    #[test]
    fn load_corrupt_file_returns_default() {
        let p = tmp_file("corrupt.json");
        std::fs::write(&p, b"{ this is not valid json ][").unwrap();
        assert_eq!(load(&p), PersistedState::default());
    }

    #[test]
    fn view_mode_serializes_and_migrates_old_values() {
        assert_eq!(serde_json::to_string(&ViewMode::Continuous).unwrap(), "\"continuous\"");
        assert_eq!(serde_json::to_string(&ViewMode::Page).unwrap(), "\"page\"");
        // 구버전 값 마이그레이션: ltr/rtl → Page
        assert_eq!(serde_json::from_str::<ViewMode>("\"page\"").unwrap(), ViewMode::Page);
        assert_eq!(serde_json::from_str::<ViewMode>("\"ltr\"").unwrap(), ViewMode::Page);
        assert_eq!(serde_json::from_str::<ViewMode>("\"rtl\"").unwrap(), ViewMode::Page);
        assert_eq!(
            serde_json::from_str::<ViewMode>("\"continuous\"").unwrap(),
            ViewMode::Continuous
        );
    }
}
