---
author: gyuha
decided: 2026-07-27 21:34
---
# 마우스 뒤로/앞으로 버튼은 `mousedown`으로 받는다 (`auxclick`을 쓰지 않는다)

마우스 뒤로/앞으로 버튼(X1/X2)을 이전/다음 파일에 매핑할 때 `window`의 **`mousedown`**에서 `MouseEvent.button`(3=뒤로, 4=앞으로)을 읽는다. 비주 버튼용 표준 이벤트인 `auxclick`을 쓰지 않는데, 이유는 취향이 아니라 실측이다 — macOS Tauri의 WKWebView에서 임시 프로브(`mousedown`·`mouseup`·`auxclick`·`pointerdown`을 전부 로깅)를 돌린 결과 **버튼 3/4에서는 `auxclick`이 한 번도 발생하지 않았고 `pointerdown`도 버튼 0에서만 발생**했다. 도달하는 것은 `mousedown`/`mouseup`뿐이다.

## Considered Options

- **`auxclick`** — 비주 버튼 전용 표준 이벤트라 의도가 가장 명확하다. 그러나 WKWebView에서 버튼 3/4에 **발생하지 않음이 실측으로 확인**되어 기능이 아예 동작하지 않는다. 기각.
- **`pointerdown`** — 포인터 통합 API로 더 현대적이지만 버튼 0에만 발생했다. 기각.
- **`mouseup`** — 도달은 하지만 누르고 뗄 때 반응하므로 파일 열기 같은 무거운 동작에서 지연으로 느껴진다. 기각.

## Consequences

- **이 선택을 지키는 자동 장치가 없다.** 순수 함수 `mouseAction(button)`의 단위 테스트는 어떤 DOM 이벤트에 바인딩했는지와 무관하게 통과하므로, 누군가 "표준 API로 현대화"하며 `auxclick`으로 바꾸면 **테스트가 전부 그린인 채로 기능만 조용히 죽는다.** 이 ADR과 `keymap.ts`의 주석이 유일한 방어선이다.
- 버튼 번호 3/4는 이 환경의 실측값이다. 다른 플랫폼(Windows/Linux)이나 버튼을 가로채는 마우스 드라이버(Logitech Options 등)에서는 값이나 도달 여부가 달라질 수 있다 — 그때는 다시 프로브로 확인할 것.
- `e.preventDefault()`를 함께 호출하지만, 이는 관측된 버그의 수정이 아니라 **보험**이다. 프로브에서 `popstate`는 발생하지 않았으므로 이 웹뷰는 스스로 히스토리를 되감지 않는다.
