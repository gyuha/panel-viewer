<!-- forge-slug: cursor-auto-hide -->
<!-- task: 20 -->
<!-- tdd: off -->
# 커서 자동 숨김 — 이미지 위 마우스 정지 시 커서 감추기 + 일반 설정 옵션

## Goal / Non-goals
- Goal: 이미지 영역 위에서 마우스가 지정한 시간(기본 1초) 동안 움직이지 않으면 커서를 감추고, 마우스를 움직이면 즉시 되살린다. 클릭·휠은 커서를 되살리지 않는다. 설정 일반 탭에서 켜고 끄며 지연 시간(초)을 지정하고, 값은 영속된다.
- Non-goals:
  - 툴바·파일 패널·설정 모달에서의 커서 숨김 (이미지 영역만)
  - 커서와 함께 UI(툴바·페이지 카운터)를 숨기는 것
  - 전체 화면 모드
  - 이 옵션을 단축키(`동작`)로 토글하는 것
  - 소수점 지연 시간 (정수 1~10초만)

## Source of truth
- Glossary terms: `커서 자동 숨김`, `보기 모드`, `동작` in `.forge/CONTEXT.md`
- Related ADRs: none (아래 "좌표 비교 가드"는 회귀 테스트가 방어선이므로 ADR로 승급하지 않는다)
- Definition of Done: 설정 일반 탭에서 커서 자동 숨김을 켜고/끄고 초를 지정할 수 있으며 재시작 후 유지된다. 이미지 영역(좌우 클릭 영역 포함) 위에서 지정 시간 정지하면 커서가 사라지고, 클릭·휠로는 되살아나지 않으며, 마우스를 움직이면 즉시 되살아난다. `task test` 그린.

## 그릴링에서 확정한 설계
- **범위는 이미지 영역만** — 한장 모드 `.viewer-stage`, 연속 모드 `.continuous`, 그리고 그 위에 얹힌 `.click-zone`. 툴바 위에 커서가 멈춰 있는 건 버튼을 누르려는 상황이므로 숨기지 않는다.
- **되살리는 유일한 입력은 `mousemove`이고, 좌표 비교 가드를 건다.** 웹뷰는 콘텐츠 스크롤·이미지 교체 시 물리적 이동 없이 `mousemove`를 합성해 쏠 수 있다. `clientX/clientY`가 직전 값과 완전히 동일하면 무시한다 — `clientX/Y`는 뷰포트 기준이라 커서가 안 움직였으면 콘텐츠가 스크롤돼도 값이 그대로다. 이 가드가 없으면 연속 모드에서 휠을 굴릴 때마다 커서가 되살아나 요구사항이 정확히 깨진다.
- **`click`/`wheel`은 아예 듣지 않는다** — 커서를 되살리지도, 타이머를 리셋하지도 않는다. 휠을 계속 굴리는 동안에도 마우스를 안 움직이면 커서는 숨는다(의도된 동작).
- **훅 호출 지점은 `Viewer` 하나** — 루트 `div.viewer`에 `cursor-hidden` 클래스만 붙이고 대상 영역 선택은 CSS가 한다. 하위 컴포넌트 prop 무변경, 타이머 중복 없음, 파일이 열렸을 때만 `Viewer`가 렌더링되므로 "빈 화면에서는 미동작"이 공짜로 따라온다. 훅은 20줄 남짓이고 사용처가 한 곳이므로 `Viewer.tsx` 안에 둔다(`src/lib/`는 순수 로직 전용).
- **함정: `.click-zone.left/.right`가 `cursor: w-resize/e-resize`를 명시 지정하고 있다**(`src/App.css:844-853`). 스테이지에만 `cursor: none`을 걸면 상속이 덮여 화면의 80%에서 커서가 그대로 보인다. `.viewer.cursor-hidden .click-zone`(클래스 3개)은 `.click-zone.left`(클래스 2개)보다 특정성이 높으므로 `!important` 없이 이긴다.
- **옵션 형태**: 체크박스(마스터 스위치) + 초 입력. 체크 해제 시 입력란은 비활성화되고 값은 보존된다. 초는 정수 1~10, 범위 밖·빈 값·비숫자는 가장 가까운 유효값으로 클램프.
- **기본값**: 켜짐 / 1초. 새 필드가 없는 기존 `state.json`도 이 기본값으로 로드된다.

## Work slices
- [ ] S1. Rust 영속 상태 + 저장 커맨드 — `state.rs`의 `PersistedState`에 `cursor_auto_hide: bool`(`#[serde(default = "default_true")]`)와 `cursor_hide_delay: u32`(`#[serde(default = "default_hide_delay")]` = 1)를 추가하고, `Default` 구현도 맞춘다. `lib.rs`에 `save_cursor_auto_hide(enabled, delay)` 커맨드 하나를 추가·등록한다(한 설정의 두 축이므로 커맨드는 하나). 기존 마이그레이션 테스트 패턴(`old_json_without_new_fields_loads_defaults`)을 따라 테스트 1개 추가.
  — 완료 기준: `cd src-tauri && cargo test` 그린이고, 두 필드가 없는 옛 JSON이 `cursor_auto_hide: true` / `cursor_hide_delay: 1`로 로드되며 새 값이 라운드트립된다.

- [ ] S2. 프런트 배선 + 설정 UI — `api.ts`의 `PersistedState`에 두 필드를 추가하고 `saveCursorAutoHide(enabled, delaySec)` 래퍼를 만든다. `App.tsx`가 로드 시 상태로 받고(`s.cursorAutoHide ?? true`, `s.cursorHideDelay ?? 1`) 변경 시 저장하며 `Viewer`·`SettingsModal`에 내린다. `SettingsModal` 일반 탭에 `커서 자동 숨김` 체크박스 행 + 초 입력을 추가한다(설명문: "이미지 위에서 마우스를 움직이지 않으면 지정한 시간 뒤 커서를 숨깁니다. 클릭·휠로는 다시 나타나지 않습니다."). 숫자 입력의 CSS는 기존 `toggle-row` 스타일에 맞춰 최소로 추가. (depends: S1)
  — 완료 기준: `task check` 그린이고, `task dev`에서 체크박스와 초를 바꾼 뒤 앱을 재시작하면 값이 그대로 유지된다.

- [ ] S3. 숨김 훅 + CSS + 회귀 테스트 — `Viewer.tsx`에 `useIdleCursor(enabled, delaySec)`를 두어 `window`의 `mousemove`(좌표 비교 가드 포함)에 타이머를 걸고, 루트 `div.viewer`에 `cursor-hidden` 클래스를 토글한다. `App.css`에 `.viewer.cursor-hidden .viewer-stage`, `.viewer.cursor-hidden .continuous`, `.viewer.cursor-hidden .click-zone`을 `cursor: none`으로 추가한다. 좌표 가드에는 "왜 필요한가"를 한 줄 주석으로 남긴다. `Viewer.test.tsx`에 회귀 테스트 2개 — ①fake timer로 지연 경과 후 루트에 `cursor-hidden`이 붙는다 ②숨은 뒤 같은 좌표의 `mousemove`·`wheel`·`click`은 클래스를 떼지 않고, 다른 좌표의 `mousemove`는 뗀다. (depends: S2)
  — 완료 기준: `task test` 그린이고, `task dev`에서 한장·연속 두 모드 모두 좌우 클릭 영역 위에서도 1초 후 커서가 사라지며, 휠을 굴리거나 클릭해도 되살아나지 않고, 마우스를 움직이면 즉시 보인다.
