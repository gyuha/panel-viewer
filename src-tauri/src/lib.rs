mod archive;
mod fs;
mod state;
mod thumbnail;

use state::{PersistedState, ViewMode};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Emitter, Manager, State};

/// OS 파일 연결(더블클릭)로 넘어온, 아직 프런트가 가져가지 않은 파일 경로.
type PendingFile = Mutex<Option<String>>;

/// 디스크에 영속되는 상태 + 그 파일 경로.
struct StateStore {
    path: PathBuf,
    data: PersistedState,
}

type PersistState = Mutex<StateStore>;

/// 현재 열려 있는 아카이브 세션. 페이지 목록만 들고 있고, 바이트는 요청 시마다 추출한다.
#[derive(Default)]
struct Session {
    path: Option<PathBuf>,
    pages: Vec<String>,
}

type ArchiveState = Mutex<Session>;

/// 아카이브를 열었을 때 프런트로 돌려주는 정보.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ArchiveInfo {
    name: String,
    page_count: usize,
}

/// 아카이브를 열어 페이지 목록을 세션에 저장하고 정보를 반환한다.
#[tauri::command]
fn open_archive(path: String, state: State<'_, ArchiveState>) -> archive::Result<ArchiveInfo> {
    let p = PathBuf::from(&path);
    let pages = archive::list_pages(&p)?;
    if pages.is_empty() {
        return Err(archive::ArchiveError(
            "이 아카이브에는 이미지가 없습니다.".into(),
        ));
    }
    let name = p
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    let page_count = pages.len();
    let mut s = state.lock().unwrap();
    s.path = Some(p);
    s.pages = pages;
    Ok(ArchiveInfo { name, page_count })
}

/// 영속 상태 전체를 읽어온다(앱 시작 시 프런트가 호출).
#[tauri::command]
fn load_state(store: State<'_, PersistState>) -> PersistedState {
    store.lock().unwrap().data.clone()
}

/// 파일별 읽던 위치를 저장한다.
#[tauri::command]
fn save_reading_position(path: String, page: usize, store: State<'_, PersistState>) {
    let mut s = store.lock().unwrap();
    s.data.reading_positions.insert(path, page);
    let (file, data) = (s.path.clone(), s.data.clone());
    let _ = state::save(&file, &data);
}

/// 마지막 보기 모드를 저장한다.
#[tauri::command]
fn save_view_mode(mode: ViewMode, store: State<'_, PersistState>) {
    let mut s = store.lock().unwrap();
    s.data.view_mode = mode;
    let (file, data) = (s.path.clone(), s.data.clone());
    let _ = state::save(&file, &data);
}

/// 마지막으로 탐색한 폴더를 저장한다.
#[tauri::command]
fn save_last_folder(folder: String, store: State<'_, PersistState>) {
    let mut s = store.lock().unwrap();
    s.data.last_folder = Some(folder);
    let (file, data) = (s.path.clone(), s.data.clone());
    let _ = state::save(&file, &data);
}

/// 단축키 커스텀 키 맵(동작명 → 키)을 저장한다.
#[tauri::command]
fn save_keybindings(
    bindings: std::collections::HashMap<String, String>,
    store: State<'_, PersistState>,
) {
    let mut s = store.lock().unwrap();
    s.data.keybindings = bindings;
    let (file, data) = (s.path.clone(), s.data.clone());
    let _ = state::save(&file, &data);
}

/// 파일 패널 숨김 상태를 저장한다.
#[tauri::command]
fn save_panel_hidden(hidden: bool, store: State<'_, PersistState>) {
    let mut s = store.lock().unwrap();
    s.data.panel_hidden = hidden;
    let (file, data) = (s.path.clone(), s.data.clone());
    let _ = state::save(&file, &data);
}

/// 창 크기(논리 픽셀)를 저장한다. 프런트가 리사이즈를 디바운스해 호출한다.
#[tauri::command]
fn save_window_size(width: f64, height: f64, store: State<'_, PersistState>) {
    let mut s = store.lock().unwrap();
    s.data.window_size = Some(state::WindowSize { width, height });
    let (file, data) = (s.path.clone(), s.data.clone());
    let _ = state::save(&file, &data);
}

/// 한장 모드 이미지 맞춤을 저장한다.
#[tauri::command]
fn save_page_fit(fit: state::PageFit, store: State<'_, PersistState>) {
    let mut s = store.lock().unwrap();
    s.data.page_fit = fit;
    let (file, data) = (s.path.clone(), s.data.clone());
    let _ = state::save(&file, &data);
}

/// 연속 모드 이미지 맞춤을 저장한다.
#[tauri::command]
fn save_continuous_fit(fit: state::ContinuousFit, store: State<'_, PersistState>) {
    let mut s = store.lock().unwrap();
    s.data.continuous_fit = fit;
    let (file, data) = (s.path.clone(), s.data.clone());
    let _ = state::save(&file, &data);
}

/// 마지막으로 연 아카이브 경로를 저장한다(파일 열기 성공 시 프런트가 호출).
#[tauri::command]
fn save_last_file(path: String, store: State<'_, PersistState>) {
    let mut s = store.lock().unwrap();
    s.data.last_file = Some(path);
    let (file, data) = (s.path.clone(), s.data.clone());
    let _ = state::save(&file, &data);
}

/// "마지막 파일 열기" 옵션을 저장한다.
#[tauri::command]
fn save_open_last_file(enabled: bool, store: State<'_, PersistState>) {
    let mut s = store.lock().unwrap();
    s.data.open_last_file = enabled;
    let (file, data) = (s.path.clone(), s.data.clone());
    let _ = state::save(&file, &data);
}

/// "파일 이어보기" 옵션을 저장한다.
#[tauri::command]
fn save_seamless(enabled: bool, store: State<'_, PersistState>) {
    let mut s = store.lock().unwrap();
    s.data.seamless = enabled;
    let (file, data) = (s.path.clone(), s.data.clone());
    let _ = state::save(&file, &data);
}

/// 히스토리 최대 개수.
const HISTORY_CAP: usize = 500;

/// 열람 히스토리에 아카이브를 기록한다(열기 성공 시 프런트가 호출). 중복은 시각 갱신+맨 위.
#[tauri::command]
fn record_history(path: String, store: State<'_, PersistState>) {
    let name = std::path::Path::new(&path)
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.clone());
    let opened_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    let entry = state::HistoryEntry {
        path,
        name,
        opened_at,
    };
    let mut s = store.lock().unwrap();
    s.data.history = state::push_history(std::mem::take(&mut s.data.history), entry, HISTORY_CAP);
    let (file, data) = (s.path.clone(), s.data.clone());
    let _ = state::save(&file, &data);
}

/// 히스토리 항목 하나를 삭제한다.
#[tauri::command]
fn delete_history(path: String, store: State<'_, PersistState>) {
    let mut s = store.lock().unwrap();
    s.data.history.retain(|e| e.path != path);
    let (file, data) = (s.path.clone(), s.data.clone());
    let _ = state::save(&file, &data);
}

/// 히스토리를 전부 비운다.
#[tauri::command]
fn reset_history(store: State<'_, PersistState>) {
    let mut s = store.lock().unwrap();
    s.data.history.clear();
    let (file, data) = (s.path.clone(), s.data.clone());
    let _ = state::save(&file, &data);
}

/// 폴더 한 단계를 읽는다. path가 없으면 홈 디렉터리를 연다.
#[tauri::command]
fn read_dir(path: Option<String>, app: tauri::AppHandle) -> Result<fs::DirListing, String> {
    let dir = match path {
        Some(p) => PathBuf::from(p),
        None => app.path().home_dir().map_err(|e| e.to_string())?,
    };
    fs::list_dir(&dir).map_err(|e| e.to_string())
}

/// 이미지 파일의 썸네일(JPEG 바이트)을 반환한다. 앱 캐시 디렉터리에 캐시.
#[tauri::command]
fn image_thumbnail(path: String, app: tauri::AppHandle) -> Result<Vec<u8>, String> {
    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("thumbnails");
    thumbnail::thumbnail(&PathBuf::from(path), &cache_dir)
}

/// 파일의 실제 OS 아이콘(PNG 바이트)을 반환한다. macOS는 NSWorkspace 아이콘.
/// 프런트가 확장자별로 캐시하므로 확장자당 한 번만 호출된다.
#[tauri::command]
fn system_icon(path: String) -> Result<Vec<u8>, String> {
    // systemicons가 deprecated된 stringWithCString: 로 임시파일 경로를 만들어
    // 한글 등 비ASCII 파일명을 처리하지 못한다. 아이콘은 확장자에만 의존하므로
    // (프런트도 확장자별 캐시) ASCII 합성 경로를 넘겨 그 버그를 우회한다.
    let ext = std::path::Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("dat");
    systemicons::get_icon(&format!("icon.{ext}"), 64).map_err(|e| e.message)
}

/// OS 파일 연결로 넘어온 대기 파일을 한 번 가져간다(있으면 소비).
#[tauri::command]
fn take_pending_file(pending: State<'_, PendingFile>) -> Option<String> {
    pending.lock().unwrap().take()
}

/// 앱을 종료한다.
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

fn mime_for(name: &str) -> &'static str {
    match std::path::Path::new(name)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .as_deref()
    {
        Some("png") => "image/png",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("avif") => "image/avif",
        Some("bmp") => "image/bmp",
        _ => "image/jpeg",
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(ArchiveState::default())
        .manage(PendingFile::default())
        .setup(|app| {
            let file = app.path().app_data_dir()?.join("state.json");
            let data = state::load(&file);
            let saved_size = data.window_size;
            app.manage(Mutex::new(StateStore { path: file, data }));

            // 저장된 창 크기 복원(현재 모니터로 상한 클램프). 없으면 config 기본 크기 유지.
            if let Some(sz) = saved_size {
                if let Some(win) = app.get_webview_window("main") {
                    let (max_w, max_h) = win
                        .current_monitor()
                        .ok()
                        .flatten()
                        .map(|m| {
                            let sf = m.scale_factor();
                            let s = m.size();
                            (s.width as f64 / sf, s.height as f64 / sf)
                        })
                        .unwrap_or((f64::INFINITY, f64::INFINITY));
                    let (w, h) = state::clamp_window_size(sz.width, sz.height, max_w, max_h);
                    let _ = win.set_size(tauri::LogicalSize::new(w, h));
                }
            }

            // 시작 인자로 넘어온 파일(Windows/Linux 파일 연결, 또는 CLI 실행)
            if let Some(arg) = std::env::args().nth(1) {
                if is_comic_arg(&arg) {
                    *app.state::<PendingFile>().lock().unwrap() = Some(arg);
                }
            }
            Ok(())
        })
        // 현재 열린 아카이브의 페이지를 인덱스로 제공: pvpage://localhost/<index>
        .register_uri_scheme_protocol("pvpage", |ctx, request| {
            use tauri::http::Response;
            let not_found = || Response::builder().status(404).body(Vec::new()).unwrap();

            let idx: usize = match request.uri().path().trim_start_matches('/').parse() {
                Ok(i) => i,
                Err(_) => return not_found(),
            };
            let state = ctx.app_handle().state::<ArchiveState>();
            let guard = state.lock().unwrap();
            let (Some(path), Some(entry)) = (guard.path.clone(), guard.pages.get(idx).cloned())
            else {
                return not_found();
            };
            drop(guard);

            match archive::read_page(&path, &entry) {
                Ok(bytes) => Response::builder()
                    .header("Content-Type", mime_for(&entry))
                    .header("Cache-Control", "no-cache")
                    .body(bytes)
                    .unwrap(),
                Err(_) => not_found(),
            }
        })
        .invoke_handler(tauri::generate_handler![
            open_archive,
            load_state,
            save_reading_position,
            save_view_mode,
            save_last_folder,
            save_keybindings,
            save_panel_hidden,
            save_window_size,
            save_page_fit,
            save_continuous_fit,
            save_last_file,
            save_open_last_file,
            save_seamless,
            record_history,
            delete_history,
            reset_history,
            read_dir,
            image_thumbnail,
            system_icon,
            take_pending_file,
            quit_app
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // macOS: 실행 중/시작 시 파일 연결로 열린 파일은 Opened 이벤트로 들어온다.
            if let tauri::RunEvent::Opened { urls } = event {
                for url in urls {
                    if let Ok(path) = url.to_file_path() {
                        let p = path.to_string_lossy().into_owned();
                        *app.state::<PendingFile>().lock().unwrap() = Some(p.clone());
                        // 이미 떠 있는 프런트에 즉시 알림(시작 시엔 프런트가 take_pending_file로 가져감)
                        let _ = app.emit("open-archive", p);
                    }
                }
            }
        });
}

/// 시작 인자가 코믹 아카이브 경로인지(대소문자 무시 확장자).
fn is_comic_arg(arg: &str) -> bool {
    let lower = arg.to_ascii_lowercase();
    lower.ends_with(".cbz") || lower.ends_with(".cbr") || lower.ends_with(".zip")
}
