# 2026-07-27 — 마우스 뒤로/앞으로 → 이전/다음 파일

## Plan vs actual
- What went as planned: 슬라이스 3개 모두 계획대로. S1은 TDD(3개 red → 구현 → 29개 그린), S2는 `Viewer`의 window `mousedown` 배선, S3은 설정 모달 고정 단축키 안내 1항목. 경계 가드와 연타 방어는 예측대로 추가 코드 0(기존 `hasPrevFile`/`hasNextFile` 가드와 `openPath`의 `opening` 재진입 가드가 그대로 커버). Rust 무변경. 차이 낮음.
- Divergences: 테스트 1개 추가(`mouseAction(5) === null`), `Viewer`의 import 멀티라인화(내 변경이 유발한 포맷 변화), React 19의 핸들러 부착 위치 때문에 `ContinuousView`의 포커스용 `onMouseDown`이 window 버블 리스너보다 먼저 실행됨을 코드 리뷰로 확인(플랜에 없던 검증 항목).

## Learnings
- Do differently next time:
  - **불확실성이 "코드를 읽어서는 답이 안 나오고 사람이 한 번 눌러보면 답이 나오는" 종류라면 그릴링 단계에서 프로브를 돌려라.** 이번 태스크의 최대 위험은 "마우스 버튼이 WKWebView에 도달하는가"였고, 이건 웹 리서치로도 확정할 수 없는(사용자 마우스 드라이버에 달린) 문제였다. 임시 프로브 파일 하나 + `App.tsx` 2줄로 클릭 두 번에 확정했고 즉시 되돌렸다. 그 결과 **플랜을 2개로 쪼갤 필요도(PLAN-FORMAT의 "중간 사람 확인" 분할 규칙), 실행 중 멈출 필요도 없어졌고**, 버튼 번호가 상수로 못 박힌 단일 플랜이 나왔다. 대가는 "fg-ask가 소스를 건드린다"는 경계 위반 하나뿐이며, `git status`로 되돌림을 검증할 수 있으므로 값이 훨씬 크다.
  - **프로브는 "되는지"만 보지 말고 "무엇이 오는지 전부" 로깅할 것.** `mousedown`·`mouseup`·`auxclick`·`pointerdown`을 함께 찍었더니 **`auxclick`이 버튼 3/4에서 전혀 발생하지 않는다**는 사실이 드러났다. `mousedown`만 확인했다면 "표준 API인 `auxclick`을 쓰자"는 나중의 리팩터가 기능을 조용히 죽였을 것이다(→ ADR로 승급). `popstate`를 함께 감시한 것도 `preventDefault`의 성격을 "버그 수정"이 아니라 "보험"으로 정직하게 기록하게 해줬다.
- Confirmed (지난 회고 교훈의 적용 결과):
  - **결함·현황 보고 전에 `grep` 전수 조사**를 먼저 했다(직전 태스크에서 `(/)` 하드코딩을 1곳으로 과소 보고한 실수의 교훈). 이번엔 "마우스 이벤트 핸들러는 `src/` 전체에 `ContinuousView.tsx:184` 단 한 곳, `stopPropagation` 없음"을 먼저 확정해 이중 처리·전파 차단 위험을 계획 단계에서 배제했다. 개수를 세고 말하는 습관이 실제로 작동한다.
  - **순수 로직 분리로 TDD를 값지게** — 다만 이번엔 값이 작았음을 기록한다. `mouseAction`은 3~4개 단정이 전부이고, 진짜 위험(어떤 DOM 이벤트에 바인딩했는지)은 테스트 사각지대에 남았다. 그 사각지대를 메우는 것이 ADR이다.

## Doc updates
- CONTEXT.md promotion: none — `단축키` 항목의 마우스 바인딩 문장은 fg-ask 그릴링 단계에서 이미 추가했고, 실행 중 새 용어나 의미 변화가 없었다.
- ADR added: `.forge/adr/260727-213439-mouse-back-forward-via-mousedown.md` — "마우스 뒤로/앞으로는 `mousedown`으로 받는다(`auxclick`을 쓰지 않는다)". 승급 근거는 3조건 중 ②맥락 없이는 의아함(`auxclick`이 표준이라 `mousedown`이 구식으로 보인다)과 ③실측으로 갈린 실제 트레이드오프가 명확하고, ①되돌리기 어려움이 "코드 변경은 작지만 실패가 조용하고 어떤 테스트도 못 잡는다"는 형태로 성립하기 때문.
