# run — 커서 자동 숨김 (task #20 / cursor-auto-hide)

실행 방식: Dynamic Workflow를 쓰지 않고 **직접 실행**. 슬라이스 3개가 S1→S2→S3 순차 의존이고 대상 파일이 6개라 병렬화 이득이 없어, fg-run의 "단일 에이전트로 충분하면 직접 처리" 규칙을 적용했다.

## 슬라이스 결과

- S1 `state.rs`에 `cursor_auto_hide`(기본 true)·`cursor_hide_delay`(기본 1) 추가, `lib.rs`에 `save_cursor_auto_hide` 커맨드 추가·등록, 마이그레이션 테스트 1개 — ✅ 계획대로 (`cargo test` 29개 그린)
- S2 `api.ts` 타입+`saveCursorAutoHide` 래퍼, `App.tsx` 상태·로드·저장 배선, `SettingsModal` 일반 탭 체크박스+초 입력, `App.css` 보조 입력 스타일 — ✅ 계획대로 (`tsc --noEmit` 그린)
- S3 `Viewer.tsx`에 `useIdleCursor` + 루트 `cursor-hidden` 클래스, `App.css` 커서 숨김 규칙 3선택자, `Viewer.test.tsx` 회귀 테스트 2개 — ✅ 계획대로 (`npx vitest run` 70개 그린)

## 계획 대비 실제

**계획대로 된 것.** 플랜이 미리 짚어둔 두 지점이 실제로 그대로였다.

1. **클릭존 CSS 함정** — `.click-zone.left/.right`가 `cursor: w-resize/e-resize`를 명시 지정하므로 스테이지 상속만으로는 안 덮인다는 진단이 맞았다. `.viewer.cursor-hidden .click-zone`(클래스 3개)이 `.click-zone.left`(클래스 2개)를 특정성으로 이겨 `!important` 없이 해결됐다. 다만 **이 부분은 CSS라 테스트가 검증하지 못한다** — UAT가 유일한 방어선이다.
2. **좌표 비교 가드** — `useIdleCursor`가 `mousemove`만 듣고 `clientX/Y`가 직전과 동일하면 무시한다. 회귀 테스트 2번이 "숨은 뒤 click·wheel·같은 좌표 mousemove는 클래스를 안 뗀다 / 다른 좌표는 뗀다"를 잡으므로, 나중에 누가 가드를 "불필요한 최적화"로 지우면 테스트가 빨개진다(ADR `260727-213439`가 기록한 "조용히 죽는 실패"를 이번엔 테스트로 막았다 — 그래서 ADR 승급은 하지 않았다).

**실행 중 내린 결정 (플랜에 없던 것).**

- **테스트 픽스처의 기본값을 앱 기본값과 다르게 뒀다.** `Viewer.test.tsx`의 `setup()`은 `cursorAutoHide`를 **기본 false**로 준다(앱 기본값은 true). 기존 8개 테스트마다 1초짜리 타이머가 걸리는 것을 피하기 위한 픽스처 선택이며, 커서 테스트는 명시적으로 true를 넘긴다. 한 줄 주석으로 이유를 남겼다.
- **`round_trip_preserves_all_fields` 테스트를 함께 고쳤다.** 이 테스트만 `..Default::default()` 없이 모든 필드를 나열하는 구조라, 필드를 추가하면 컴파일이 깨진다. 내 변경이 유발한 수정이므로 정리 범위 안이다.
- **지연 클램프를 프런트와 백엔드 양쪽에 뒀다.** `SettingsModal`의 `clampDelay`(1~10, 반올림, 비유한값 방어)와 `save_cursor_auto_hide`의 `delay.clamp(1, 10)`. 커맨드는 프런트만 부르지만, 영속 값의 유효 범위를 소유하는 쪽은 백엔드라고 봤다.
- **숫자 입력에 `stopPropagation`을 붙였다.** 입력란이 `<label>` 안에 있어서 클릭이 체크박스 토글로 올라간다 — 초를 고치려다 기능이 꺼지는 동작이라 막았다.
- **타이머를 마운트 시점에 즉시 건다(`arm()`).** 파일을 연 뒤 마우스를 한 번도 안 움직여도 지연 후 숨는다. "움직이지 않고 있으면 숨긴다"는 요구에 맞다고 판단했다.

**정리하지 않은 것.** `cargo fmt --check`가 `fs.rs:128`·`lib.rs:77`·`state.rs` 4곳에서 diff를 낸다. 내 변경 **이전에도 동일하게 7곳**이었음을 stash로 확인했다(줄 번호만 이동). 기존 드리프트이므로 손대지 않았다 — 별도 정리가 필요하면 독립 태스크.

**막힌 곳.** 없음.

**검증 사각지대(UAT가 필요한 이유).** `cursor: none`이 WKWebView에서 실제로 적용되는지, 클릭존 특정성 계산이 실제 렌더에서도 맞는지, 그리고 웹뷰가 스크롤 시 합성 `mousemove`를 쏘는지는 **jsdom 테스트가 답하지 못한다.** 좌표 가드는 합성 이벤트가 오든 안 오든 옳게 동작하도록 설계했으므로 프로브는 생략했지만, 실제 화면 확인은 남는다.
