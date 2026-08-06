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

/// 마지막 창 크기(논리 픽셀). f64를 담으므로 PersistedState는 Eq를 derive하지 않는다.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Default)]
pub struct WindowSize {
    pub width: f64,
    pub height: f64,
}

/// 한장 모드 이미지 맞춤. 기본값 = 화면에 맞추기(현재 동작).
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
pub enum PageFit {
    #[serde(rename = "original")]
    Original,
    #[serde(rename = "width")]
    Width,
    #[serde(rename = "height")]
    Height,
    #[default]
    #[serde(rename = "screen")]
    Screen,
}

/// 연속 모드 이미지 맞춤. 기본값 = 폭 맞추기(현재 동작).
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
pub enum ContinuousFit {
    #[serde(rename = "original")]
    Original,
    #[default]
    #[serde(rename = "width")]
    Width,
}

/// 히스토리 한 항목: 연 아카이브 경로 · 표시용 파일명 · 마지막으로 연 시각(epoch ms).
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub path: String,
    pub name: String,
    pub opened_at: u64,
}

/// 히스토리에 항목 추가: 같은 path는 제거하고 맨 앞에 넣은 뒤 cap개로 자른다(최신순 유지).
pub fn push_history(
    mut history: Vec<HistoryEntry>,
    entry: HistoryEntry,
    cap: usize,
) -> Vec<HistoryEntry> {
    history.retain(|e| e.path != entry.path);
    history.insert(0, entry);
    history.truncate(cap);
    history
}

fn default_true() -> bool {
    true
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
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
    /// 파일 패널을 숨긴 상태인지. 필드가 없으면(구버전) false(표시)로 로드.
    #[serde(default)]
    pub panel_hidden: bool,
    /// 마지막 창 크기. 없으면(구버전/최초 실행) None → config 기본 크기 사용.
    #[serde(default)]
    pub window_size: Option<WindowSize>,
    /// 창을 다른 창 위에 고정한 상태인지. 필드가 없으면(구버전) false(고정 안 함)로 로드.
    #[serde(default)]
    pub always_on_top: bool,
    /// 한장 모드 이미지 맞춤. 없으면 기본값(화면에 맞추기).
    #[serde(default)]
    pub page_fit: PageFit,
    /// 연속 모드 이미지 맞춤. 없으면 기본값(폭 맞추기).
    #[serde(default)]
    pub continuous_fit: ContinuousFit,
    /// 마지막으로 연 아카이브 절대경로(마지막 파일 열기용).
    #[serde(default)]
    pub last_file: Option<String>,
    /// 앱을 그냥 실행했을 때 마지막 파일을 자동으로 열지. 필드가 없으면(구버전) ON.
    #[serde(default = "default_true")]
    pub open_last_file: bool,
    /// 파일 이어보기(페이지 경계에서 인접 파일 자동 열기).
    #[serde(default)]
    pub seamless: bool,
    /// 열람 히스토리(최신순). 필드가 없으면(구버전) 빈 목록으로 로드.
    #[serde(default)]
    pub history: Vec<HistoryEntry>,
}

impl Default for PersistedState {
    fn default() -> Self {
        Self {
            last_folder: None,
            view_mode: ViewMode::default(),
            reading_positions: HashMap::new(),
            keybindings: HashMap::new(),
            panel_hidden: false,
            window_size: None,
            always_on_top: false,
            page_fit: PageFit::default(),
            continuous_fit: ContinuousFit::default(),
            last_file: None,
            open_last_file: true,
            seamless: false,
            history: Vec::new(),
        }
    }
}

/// 저장된 창 크기를 모니터 한계로 상한 제한한다(하한은 두지 않는다).
pub fn clamp_window_size(width: f64, height: f64, max_width: f64, max_height: f64) -> (f64, f64) {
    (width.min(max_width), height.min(max_height))
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
            panel_hidden: true,
            window_size: None,
            always_on_top: true,
            page_fit: PageFit::Screen,
            continuous_fit: ContinuousFit::Width,
            last_file: None,
            open_last_file: true,
            seamless: false,
            history: Vec::new(),
        };
        s.reading_positions.insert("/a/b.cbz".into(), 37);
        s.reading_positions.insert("/a/c.cbr".into(), 4);
        s.keybindings.insert("nextFile".into(), ".".into());
        s.keybindings.insert("prevFile".into(), ",".into());
        s.window_size = Some(WindowSize {
            width: 1000.0,
            height: 700.0,
        });
        save(&p, &s).unwrap();

        let loaded = load(&p);
        assert_eq!(loaded, s);
        assert_eq!(loaded.view_mode, ViewMode::Continuous);
        assert_eq!(loaded.reading_positions.get("/a/b.cbz"), Some(&37));
        assert_eq!(loaded.keybindings.get("nextFile"), Some(&".".to_string()));
        assert!(loaded.panel_hidden);
        assert!(loaded.always_on_top);
    }

    #[test]
    fn old_json_without_new_fields_loads_defaults() {
        let p = tmp_file("no_new_fields.json");
        // keybindings·panelHidden 필드가 없는 구버전 상태
        std::fs::write(
            &p,
            br#"{"lastFolder":null,"viewMode":"page","readingPositions":{"/a.cbz":3}}"#,
        )
        .unwrap();
        let loaded = load(&p);
        assert!(loaded.keybindings.is_empty());
        assert!(!loaded.panel_hidden); // 기본값 false(표시)
        assert_eq!(loaded.reading_positions.get("/a.cbz"), Some(&3));
    }

    #[test]
    fn clamp_keeps_size_within_monitor() {
        assert_eq!(clamp_window_size(800.0, 600.0, 1440.0, 900.0), (800.0, 600.0));
    }

    #[test]
    fn clamp_caps_size_larger_than_monitor() {
        assert_eq!(clamp_window_size(2000.0, 1200.0, 1440.0, 900.0), (1440.0, 900.0));
        // 한 축만 초과하면 그 축만 제한
        assert_eq!(clamp_window_size(2000.0, 600.0, 1440.0, 900.0), (1440.0, 600.0));
    }

    #[test]
    fn clamp_at_exact_boundary_is_unchanged() {
        assert_eq!(clamp_window_size(1440.0, 900.0, 1440.0, 900.0), (1440.0, 900.0));
    }

    #[test]
    fn window_size_round_trips_and_old_json_has_none() {
        let p = tmp_file("winsize.json");
        let s = PersistedState {
            window_size: Some(WindowSize {
                width: 900.0,
                height: 640.0,
            }),
            ..Default::default()
        };
        save(&p, &s).unwrap();
        assert_eq!(
            load(&p).window_size,
            Some(WindowSize {
                width: 900.0,
                height: 640.0
            })
        );

        // 구버전 JSON(windowSize 필드 없음) → None
        let p2 = tmp_file("no_winsize.json");
        std::fs::write(
            &p2,
            br#"{"lastFolder":null,"viewMode":"page","readingPositions":{}}"#,
        )
        .unwrap();
        assert_eq!(load(&p2).window_size, None);
    }

    #[test]
    fn image_fit_defaults_round_trip_and_migration() {
        // 기본값: 한장=화면, 연속=폭 (현재 동작 유지)
        let d = PersistedState::default();
        assert_eq!(d.page_fit, PageFit::Screen);
        assert_eq!(d.continuous_fit, ContinuousFit::Width);

        // 라운드트립
        let p = tmp_file("fit.json");
        let s = PersistedState {
            page_fit: PageFit::Height,
            continuous_fit: ContinuousFit::Original,
            ..Default::default()
        };
        save(&p, &s).unwrap();
        let l = load(&p);
        assert_eq!(l.page_fit, PageFit::Height);
        assert_eq!(l.continuous_fit, ContinuousFit::Original);

        // serde 값 이름
        assert_eq!(serde_json::to_string(&PageFit::Width).unwrap(), "\"width\"");
        assert_eq!(serde_json::to_string(&PageFit::Screen).unwrap(), "\"screen\"");
        assert_eq!(
            serde_json::to_string(&ContinuousFit::Original).unwrap(),
            "\"original\""
        );

        // 구버전 JSON(필드 없음) → 기본값
        let p2 = tmp_file("no_fit.json");
        std::fs::write(
            &p2,
            br#"{"lastFolder":null,"viewMode":"page","readingPositions":{}}"#,
        )
        .unwrap();
        let l2 = load(&p2);
        assert_eq!(l2.page_fit, PageFit::Screen);
        assert_eq!(l2.continuous_fit, ContinuousFit::Width);
    }

    #[test]
    fn reading_options_defaults_and_migration() {
        // 기본값: 마지막 파일 열기 ON, 이어보기 OFF, last_file 없음
        let d = PersistedState::default();
        assert!(d.open_last_file);
        assert!(!d.seamless);
        assert_eq!(d.last_file, None);

        // 라운드트립
        let p = tmp_file("reading.json");
        let s = PersistedState {
            last_file: Some("/a/b.cbz".into()),
            open_last_file: false,
            seamless: true,
            ..Default::default()
        };
        save(&p, &s).unwrap();
        let l = load(&p);
        assert_eq!(l.last_file.as_deref(), Some("/a/b.cbz"));
        assert!(!l.open_last_file);
        assert!(l.seamless);

        // 구버전 JSON(필드 없음): open_last_file은 true로, 나머지는 기본값으로 로드
        let p2 = tmp_file("no_reading.json");
        std::fs::write(
            &p2,
            br#"{"lastFolder":null,"viewMode":"page","readingPositions":{}}"#,
        )
        .unwrap();
        let l2 = load(&p2);
        assert!(l2.open_last_file); // 없던 필드도 ON 기본
        assert!(!l2.seamless);
        assert_eq!(l2.last_file, None);
    }

    #[test]
    fn always_on_top_defaults_off_round_trips_and_migrates() {
        // 기본값: 꺼짐(다른 창 위로 올리지 않는다)
        assert!(!PersistedState::default().always_on_top);

        // 라운드트립
        let p = tmp_file("always_on_top.json");
        let s = PersistedState {
            always_on_top: true,
            ..Default::default()
        };
        save(&p, &s).unwrap();
        assert!(load(&p).always_on_top);

        // 구버전 JSON(필드 없음) → 꺼진 상태로 로드
        let p2 = tmp_file("no_always_on_top.json");
        std::fs::write(
            &p2,
            br#"{"lastFolder":null,"viewMode":"page","readingPositions":{}}"#,
        )
        .unwrap();
        assert!(!load(&p2).always_on_top);
    }

    #[test]
    fn push_history_dedupes_moves_to_front_and_caps() {
        let e = |p: &str, t: u64| HistoryEntry {
            path: p.into(),
            name: p.into(),
            opened_at: t,
        };
        let paths = |h: &[HistoryEntry]| h.iter().map(|x| x.path.clone()).collect::<Vec<_>>();

        let h = push_history(vec![], e("/a", 1), 3);
        assert_eq!(paths(&h), ["/a"]);
        let h = push_history(h, e("/b", 2), 3);
        assert_eq!(paths(&h), ["/b", "/a"]); // 신규는 맨 앞
        let h = push_history(h, e("/a", 3), 3);
        assert_eq!(paths(&h), ["/a", "/b"]); // 재추가 → 중복 제거 후 맨 앞
        assert_eq!(h[0].opened_at, 3); // 시각 갱신
        assert_eq!(h.len(), 2);
        let h = push_history(h, e("/c", 4), 3); // [c,a,b]
        let h = push_history(h, e("/d", 5), 3); // cap 3 → 가장 오래된 b 제거
        assert_eq!(paths(&h), ["/d", "/c", "/a"]);
        assert_eq!(h.len(), 3);
    }

    #[test]
    fn history_serde_and_migration() {
        // 구버전 JSON(history 없음) → 빈 Vec
        let p = tmp_file("no_history.json");
        std::fs::write(
            &p,
            br#"{"lastFolder":null,"viewMode":"page","readingPositions":{}}"#,
        )
        .unwrap();
        assert!(load(&p).history.is_empty());

        // 라운드트립
        let p2 = tmp_file("history.json");
        let s = PersistedState {
            history: vec![HistoryEntry {
                path: "/a/x.cbz".into(),
                name: "x.cbz".into(),
                opened_at: 123,
            }],
            ..Default::default()
        };
        save(&p2, &s).unwrap();
        assert_eq!(load(&p2).history, s.history);
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
