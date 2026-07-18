# run — 창 크기 기억 후 복원

## 계획 대비 실제

### S1. 데이터 모델 + 클램프 순수 로직 (TDD) — 계획대로 (+필연적 파생 1건)
- `src-tauri/src/state.rs`:
  - `WindowSize { width: f64, height: f64 }` 구조체 추가(Serialize/Deserialize/Clone/Copy/PartialEq/Default).
  - `PersistedState`에 `#[serde(default)] window_size: Option<WindowSize>` 추가(camelCase `windowSize`).
  - 순수 함수 `clamp_window_size(w,h,max_w,max_h) -> (f64,f64)`(각 축 min).
- 테스트 우선: 클램프 3케이스 + windowSize 라운드트립/구버전 마이그레이션 추가 → red 확인 → 구현 → green.
- **필연적 파생**: f64는 Eq 불가라 `PersistedState`의 `Eq` derive 제거(PartialEq만 유지). 기존 테스트는 `assert_eq!`에 PartialEq만 쓰므로 영향 없음. 기존 `round_trip` 테스트 구조체 리터럴에 `window_size` 필드 추가.
- 완료 기준(cargo test 그린) 충족: state 테스트 9개(기존 5 + 신규 4) 통과.

### S2. 백엔드 저장 커맨드 + setup() 복원 — 계획대로
- `src-tauri/src/lib.rs`:
  - `#[tauri::command] save_window_size(width,height)` 추가 → `PersistedState.window_size` 갱신 후 `state::save`. invoke_handler 등록.
  - `setup()`: 로드된 `window_size`가 있으면 `main` 창의 `current_monitor()` 크기(physical÷scale→logical)로 `clamp_window_size` 적용해 `set_size(LogicalSize)`. 없으면 config 기본 유지.
- 창 라벨은 config에 없어 기본 `main` — `get_webview_window("main")` 정상 해석 확인(런타임).
- 완료 기준(cargo check/build + 복원 반영) 충족.

### S3. 프론트 리사이즈 저장 배선 — 계획대로
- `src/lib/api.ts`: `saveWindowSize(width,height)` invoke 래퍼 + `PersistedState`에 `windowSize` 타입 추가.
- `src/App.tsx`: `getCurrentWindow().onResized` 구독 → 400ms 디바운스 → `scaleFactor`로 논리 픽셀 환산해 `saveWindowSize` 호출, 언마운트 시 타이머·리스너 정리. 훅은 early-return 이전에 배치.
- 완료 기준(tsc + 리사이즈 저장) 충족.

## 검증 (UAT)
- 단위: cargo test 18개(clamp 3 + serde 마이그레이션/라운드트립 1 = 신규 4 포함), tsc, vitest 27 모두 green.
- 런타임 스모크(단일 실행, state.json에 800×600 선주입):
  - `[SMOKE] restore w=800 h=600` — setup()이 저장값을 읽어 `main` 창 클램프 후 set_size 호출(복원 경로 end-to-end).
  - `[SMOKE] save w=800 h=884`, `w=790 h=969` — 리사이즈 → onResized → scaleFactor 환산 → save_window_size 발화(저장 경로 end-to-end). 값이 논리 픽셀 범위(물리 1600 아님) → scale 환산 정상.
- 원본 state.json은 백업(.smokebak, 주입 이전본)으로 복원, 임시 진단 3곳 제거 확인(grep 깨끗).

## 즉석 결정
- 저장 크기는 **논리 픽셀**로 통일(프론트 physical÷scaleFactor 저장, 백엔드 LogicalSize 복원) — DPI 변동에 강함.
- 복원 클램프 상한은 모니터 **전체 크기**(work_area 아님) 사용 — 상한 방어 목적엔 충분하고 API 단순.

## 막힌 곳 / 유의
- 스모크에서 프로그램적 setSize(942×673) 값이 로그에 안 뜬 것은 `import("@tauri-apps/api/dpi")` 동적 임포트가 vite 의존성 재최적화 → 페이지 리로드를 유발한 **테스트 하네스 아티팩트**(실사용엔 없음). 배선 발화 자체는 양쪽 확인됨.
- 최소 크기 하한(floor)은 비목표라 없음 — 저장된 아주 작은 크기도 그대로 복원(추후 필요 시 tauri.conf minWidth/minHeight).
