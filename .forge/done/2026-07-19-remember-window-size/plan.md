<!-- forge-slug: remember-window-size -->
<!-- task: 8 -->
<!-- tdd: on -->
# 창 크기 기억 후 복원

## Goal / Non-goals
- Goal: 사용자가 바꾼 창 크기(너비·높이)를 저장해 두고, 다음 실행 시 그 크기로 창이 열리게 한다. 저장 크기가 현재 모니터보다 크면 모니터로 상한 제한한다.
- Non-goals:
  - 창 **위치**(x/y) 기억 — 이번엔 크기만
  - **최대화/전체화면** 상태 기억
  - 최소 크기 하한(floor) 설정 — 저장된 작은 값도 그대로 복원
  - 다중 창 지원 — `main` 창 하나만
  - 공식 `tauri-plugin-window-state` 도입 — 크기만이면 과함(별도 상태 파일 + 새 의존성)

## Source of truth
- Glossary terms: 영속 상태(state.json) — `.forge/CONTEXT.md`(새 용어 없음)
- Related ADRs: none (기존 state.json 확장은 의외성 낮은 일관된 선택 — ADR 3조건 미충족)
- 결정 사항(그릴링 확정):
  - **크기만** 저장·복원(논리 픽셀). 위치/최대화는 비목표.
  - **기존 `state.json`(`PersistedState`) 확장**으로 해결. 플러그인 미사용.
  - **복원은 백엔드 `setup()`**에서 저장 크기를 현재 모니터로 클램프 후 `set_size` → 시작 깜빡임 없음. 저장값이 없으면 `tauri.conf.json`의 1100×760 기본값 유지.
  - **저장은 프론트**가 `onResized`를 ~400ms 디바운스(기존 읽던-위치 저장 패턴 재사용)해 `save_window_size` 커맨드 호출. 논리 픽셀로 저장(PhysicalSize ÷ scaleFactor).
  - **클램프**: 순수 함수 `clamp_window_size(w,h,maxW,maxH)`가 모니터 작업영역(상한)으로 제한, 하한 없음.
- Definition of Done: 창 크기를 바꾸고 앱을 종료한 뒤 다시 켜면 그 크기로 열린다(깜빡임 없이). 저장 크기가 현재 모니터보다 크면 모니터 크기로 줄여 연다. 크기 정보가 없던 구버전 `state.json`도 정상 로드된다(읽던 위치 등 유지).

## Work slices
- [ ] S1. 데이터 모델 + 클램프 순수 로직 (TDD) — `src-tauri/src/state.rs`: `WindowSize { width: f64, height: f64 }` 구조체 + `PersistedState`에 `#[serde(default)] window_size: Option<WindowSize>`(camelCase `windowSize`) 추가; 순수 함수 `clamp_window_size(w,h,max_w,max_h) -> (f64,f64)`(각 축 min). — 완료 기준: cargo test 그린 — 클램프(경계 내 유지 / 초과 시 상한 / 정확히 경계) + serde(구버전 JSON에 windowSize 없어도 로드=None, 크기 포함 라운드트립)
- [ ] S2. 백엔드 저장 커맨드 + setup() 복원 — `src-tauri/src/lib.rs`: `#[tauri::command] save_window_size(width,height)`가 `PersistedState.window_size` 갱신 후 `state::save`, invoke_handler 등록; `setup()`에서 로드된 `window_size`가 있으면 `main` 창의 현재 모니터 크기(physical÷scale→logical)로 `clamp_window_size` 적용해 `set_size(LogicalSize)`. 창 라벨/모니터 API(`get_webview_window("main")`, `current_monitor().size()/scale_factor()`) 실제 시그니처 확인. — 완료 기준: cargo check/build 통과, 저장 크기가 복원 경로에 반영됨(런타임 확인) (depends: S1)
- [ ] S3. 프론트 리사이즈 저장 배선 — `src/lib/api.ts`에 `saveWindowSize(width,height)` invoke 래퍼(+`PersistedState` 타입에 `windowSize?` 추가); `src/App.tsx`에 effect로 `getCurrentWindow().onResized` 구독 → 400ms 디바운스 → `scaleFactor`로 논리 픽셀 환산해 `saveWindowSize` 호출, 언마운트 시 타이머·리스너 정리. — 완료 기준: tsc 통과, 창 리사이즈 후 재실행 시 크기 유지(런타임 확인) (depends: S2)
