<!-- forge-slug: mouse-back-forward-file-nav -->
<!-- task: 16 -->
<!-- tdd: on -->
# 마우스 뒤로/앞으로 버튼 → 이전/다음 파일

## Goal / Non-goals
- Goal: 마우스의 뒤로(`button=3`) / 앞으로(`button=4`) 버튼을 기존 동작 `prevFile`/`nextFile`에 고정 매핑한다. 툴바 `<` `>` 버튼과 커스텀 키 `,`/`.`와 **완전히 같은 동작**을 호출하며, 설정 모달의 "고정 단축키" 안내에 표시한다.
- Non-goals:
  - **재지정 가능하게 만들기** — 마우스 버튼은 고정. `CustomKeys`/`resolve`/`isAssignableKey`/캡처 UI는 손대지 않는다(그릴링 확정)
  - **상위 폴더 이동에 매핑** — 이 앱에는 `상위 폴더`(`FilePanel.tsx:114`)가 따로 있지만 뒤로 버튼은 파일 이동 한 가지 의미만 갖는다. 폴더 계층 이동은 별도 태스크
  - **문맥 의존 동작** — 커서 위치·앱 상태에 따라 의미가 바뀌지 않는다
  - **파일이 안 열린 상태에서의 동작** — Viewer 범위이므로 무동작
  - `auxclick`/`pointerdown` 경로 — 프로브에서 버튼 3/4에는 오지 않음이 확인됨(아래)
  - 연타 디바운스 — `openPath`의 재진입 가드(`opening` ref)가 이미 처리
  - Rust 네이티브 마우스 훅 — 불필요(프런트엔드로 도달 확인됨)

## Source of truth
- Glossary terms(이번 그릴링에서 갱신): `단축키(Keybinding)` — "키 외의 입력도 동작에 묶일 수 있다 — 다음/이전 파일은 마우스 앞으로/뒤로 버튼에도 고정으로(재지정 불가) 매핑된다" 추가. `동작(Action)`·`코믹 아카이브`·`파일 이어보기`는 기존 정의 그대로. → `.forge/CONTEXT.md`
  - **용어 교정**: 요청의 "도서"는 용어집에 없는 말이다. 단위는 **코믹 아카이브**이고 동작명은 **이전 파일/다음 파일**. 이동 범위는 **현재 폴더**.
- Related ADRs: none — 기존 동작에 입력 하나를 더 묶는 것으로 가역적이고 놀랍지 않아 ADR 3조건 미달(직전 두 단축키 태스크와 같은 판단).
- **런타임 프로브 결과(그릴링 중 실측, 임시 프로브는 되돌림)** — 이 태스크의 최대 불확실성을 미리 해소한 데이터:
  - 뒤로 버튼 → `mousedown button=3` (`buttons=8` = X1), 앞으로 → `mousedown button=4` (`buttons=16` = X2). 표준 매핑 그대로 WKWebView에 도달하며 마우스 드라이버가 가로채지 않았다.
  - **`auxclick`은 버튼 3/4에서 한 번도 발생하지 않았고**, `pointerdown`도 버튼 0에서만 발생했다 → 사용 가능한 이벤트는 `mousedown`/`mouseup`뿐.
  - **`popstate`가 발생하지 않았다** → 웹뷰는 스스로 히스토리를 되감지 않는다. 따라서 `preventDefault()`는 관측된 버그의 수정이 아니라 **보험**이며, 그 이유로 유지한다(빈 웹뷰라는 치명적·진단 어려운 실패를 1줄로 막음).
- 기존 코드(확인 완료):
  - `src/lib/keymap.ts` — `Action` 10종. `resolve`는 문자열 키 전용이라 마우스는 통과하지 않는다.
  - `src/components/Viewer.tsx:66-93` — window `keydown`에서 `resolve` 결과로 `onNextFile`/`onPrevFile`/모드 전환 처리. `shortcutsEnabled`(=`!settingsOpen`) 가드.
  - `src/App.tsx:361-366` — `onPrevFile`/`onNextFile`이 이미 `hasPrevFile`/`hasNextFile`로 경계 가드 → 첫/마지막 아카이브에서 무동작. **추가 가드 불필요.**
  - `src/components/SettingsModal.tsx:262` — "고정 단축키: `⌘ ,` 메뉴 열기 · `Esc` 닫기" 안내 줄(재지정 불가 항목 전용 자리).
  - 마우스 이벤트 핸들러는 `src/` 전체에서 `ContinuousView.tsx:184`(포커스용 `onMouseDown`)뿐이고 `stopPropagation`을 하지 않는다 → window 버블 단계로 충분. 모달 백드롭의 `stopPropagation`은 `click` 대상이라 무관.
  - `PageView`의 `click-zone`은 `<button>`이라 `onClick`이 버튼 0에만 반응 → 충돌 없음.
- 결정 사항(그릴링 확정):
  1. 매핑은 `keymap.ts`의 **순수 함수** `mouseAction(button: number): Action | null`로 분리 — 컴포넌트 안 숫자 비교(테스트 불가)도, 키맵 namespace 편입(마우스 개념이 4파일로 번짐)도 아닌 중간.
  2. 이벤트는 **`mousedown`** + `e.preventDefault()`, `window` 버블 단계, `Viewer`의 기존 단축키 계층.
  3. 의미는 **한 가지**(이전/다음 파일), 범위는 **Viewer**(파일 열림 시에만).
  4. 설정 모달의 **"고정 단축키" 안내 줄에 1줄 추가**(표에 행으로 넣지 않는다 — 표 3열은 편집 버튼이므로 눌러도 안 되는 컨트롤이 생긴다).
- Definition of Done:
  - 아카이브를 읽는 중 마우스 뒤로 → 현재 폴더의 이전 아카이브, 앞으로 → 다음 아카이브가 열린다. 한장·연속 두 모드 모두에서 동작한다.
  - 첫 아카이브에서 뒤로, 마지막에서 앞으로는 무동작(기존 경계 가드 상속). 파일이 안 열린 빈 화면에서도 무동작.
  - 설정 모달 열림 중에는 발동하지 않는다.
  - 버튼을 연타해도 파일 열기가 인터리브되지 않는다(`opening` 가드).
  - 화면이 빈 페이지가 되거나 웹뷰가 뒤로 이동하지 않는다.
  - 설정 모달 `단축키` 탭의 "고정 단축키" 줄에 마우스 뒤로/앞으로 안내가 보인다.
  - `task check`와 `task test` 그린.

## Work slices
- [ ] S1. `keymap.ts`에 `mouseAction` 추가 (TDD) — 실패 테스트 먼저: `mouseAction(3) === "prevFile"`, `mouseAction(4) === "nextFile"`, `mouseAction(0) === null`, `mouseAction(1) === null`, `mouseAction(2) === null`(왼쪽·가운데·오른쪽 클릭이 파일 이동을 유발하지 않는다는 회귀 가드 — 버튼 번호 상수를 못 박는 것이 이 테스트의 핵심 가치). 구현은 버튼 번호 → `Action` 매핑 하나. `CustomKeys`·`resolve`·`STANDARD_KEYS`는 **건드리지 않는다**. — 완료 기준: `npx vitest run src/lib/keymap.test.ts` 그린(기존 26개 무회귀) (depends: 없음)
- [ ] S2. `Viewer.tsx` 배선 — 기존 keydown `useEffect`와 **별개의** `useEffect`로 window `mousedown` 리스너 추가: `shortcutsEnabled` 가드 → `mouseAction(e.button)` → `prevFile`/`nextFile`이면 `e.preventDefault()` 후 `onPrevFile()`/`onNextFile()`. deps는 `[shortcutsEnabled, onPrevFile, onNextFile]`. — 완료 기준: **런타임 스모크 필수**(회고 교훈: GUI 배선은 빌드·단위테스트로 안 잡힌다) — `task dev`로 폴더에 아카이브 2개 이상 있는 상태에서 뒤로/앞으로가 파일을 바꾸고, 한장·연속 두 모드 모두에서 되고, 첫/마지막 경계에서 무동작, 설정 모달 열림 중 미발동, 연타 시 정상, 화면이 깨지지 않음 (depends: S1)
- [ ] S3. `SettingsModal.tsx` 안내 — `fixed-keys` 안내 줄에 마우스 항목 추가(예: "마우스 뒤로/앞으로 = 이전/다음 파일"). 표시 전용, 표는 손대지 않는다. — 완료 기준: `task check` 통과 + `단축키` 탭에서 안내가 보임 (depends: 없음)
