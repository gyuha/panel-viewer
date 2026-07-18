# 2026-07-18 — 설정 가능한 읽기 단축키 + 단축키 설정 모달

## Plan vs actual
- What went as planned: 4개 슬라이스 모두 계획대로. S1 키맵 순수 로직·S2 Rust 키바인딩 영속은 TDD로 테스트 우선(각 12·5개 그린), S3 배선(Viewer=파일이동 두 모드, PageView=페이지 이동)·S4 설정 모달(파일 패널 버튼→모달, 캡처·충돌 거부·기본값 복원·영속) 완성. 차이 낮음.
- Divergences: 플랜에 없던 UI 편의 추가 — `ACTION_LABELS`(한글 라벨), `keyLabel`(Space/→ 표기), 커스텀 키 지우기(✕). PageView의 하드코딩 키 switch를 `resolve()` 기반으로 통합(표준 키를 `STANDARD_KEYS`로 정의). 모달 키 캡처는 capture phase로 가로챔.

## Learnings
- Do differently next time:
  - **GUI 배선 슬라이스는 빌드·단위테스트로 안 잡힌다.** 이번 세션에서 한장 이미지 미표시, 파일이동 핑퐁, systemicons 한글 경로 실패가 모두 컴파일·단위테스트를 통과하고도 런타임에서만 드러났다. 단축키 배선도 `window.dispatchEvent(KeyboardEvent)` + 자동 파일열기로 런타임 스모크를 돌려서야 확인됐다. → GUI/키보드/프로토콜 배선 슬라이스는 완료 선언 전에 **런타임 dispatch/auto-drive 스모크**를 반드시 넣을 것(연속 모드처럼 컴포넌트가 안 뜨는 케이스 포함).
  - **순수 로직 분리가 TDD를 값지게 만든다.** 키→동작 해석·충돌 검사·키 유효성을 `keymap.ts`로 떼어내니 DOM 없이 12개 테스트로 커버됐고, 컴포넌트(Viewer/PageView/모달)는 그 로직을 호출만 한다. 이중 처리 방지는 `resolve`의 모드 필터(페이지 동작은 한장 모드만, 파일 동작은 두 모드)로 해결 — 핸들러를 Viewer(파일)·PageView(페이지)로 나눠도 겹치지 않음.
  - **용어집이 코드와 어긋날 수 있다.** fg-ask 단계에서 CONTEXT.md의 "보기 모드"가 3개(좌우 방향 포함)로 남아 있어(코드는 이미 2개) 정정했다. 모드/개념을 바꾼 뒤엔 CONTEXT.md도 같이 손볼 것.

## Doc updates
- CONTEXT.md promotion: none (동작·단축키 용어는 fg-ask 단계에서 이미 추가, 실행 중 새 용어 없음)
- ADR added: none (표준 키 고정+커스텀 1개 모델은 가역적·비잠금이라 ADR 기준 미달)
