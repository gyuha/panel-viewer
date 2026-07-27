# RUN — 마우스 뒤로/앞으로 → 이전/다음 파일 (mouse-back-forward-file-nav)

실행 방식: **Dynamic Workflow 미사용, 직접 실행**. 3파일 · 약 25줄. `eco` off, `tdd: on`(테스트 우선 준수).

## 계획대로 된 것
- **S1 (TDD)** — `keymap.test.ts`에 `마우스 버튼 동작` describe 추가 → 3개 실패(red, `mouseAction is not a function`) 확인 → `keymap.ts`에 `mouseAction(button)` 구현 → 29개 그린(기존 26 무회귀). `CustomKeys`·`resolve`·`STANDARD_KEYS`는 계획대로 손대지 않음.
- **S2** — `Viewer.tsx`에 기존 keydown과 **별개의** `useEffect`로 window `mousedown` 리스너 추가. `shortcutsEnabled` 가드 → `mouseAction(e.button)` → `preventDefault()` + `onPrevFile()`/`onNextFile()`. deps `[shortcutsEnabled, onPrevFile, onNextFile]`.
- **S3** — `SettingsModal`의 `fixed-keys` 안내 줄에 `마우스 뒤로/앞으로 = 이전/다음 파일` 추가. 표는 손대지 않음.
- 경계 가드·연타 방어는 예측대로 **추가 코드 0** — `App.tsx`의 `onPrevFile`/`onNextFile`이 이미 `hasPrevFile`/`hasNextFile`로 가드하고 `openPath`의 `opening` 재진입 가드가 연타를 흡수한다.
- `task check`(tsc + cargo check) 통과, 전체 테스트 46개(프론트 46 / Rust 27) 그린.

## Divergences
**전반적으로 차이가 낮다.** 이 태스크의 최대 불확실성(마우스 버튼이 웹뷰에 도달하는지, 어떤 이벤트로 오는지, 버튼 번호가 몇인지)이 **그릴링 단계의 런타임 프로브로 이미 해소된 상태로 플랜에 들어왔기** 때문이다 — 실행 중 예상 밖의 사실이 새로 드러나지 않았다.

1. **테스트 1개 추가** — 플랜의 테스트 목록(버튼 3/4/0/1/2)에 없던 `mouseAction(5) === null`을 넣었다. 정의되지 않은 버튼 번호가 조용히 동작으로 해석되지 않는다는 가드.
2. **`Viewer.tsx`의 import를 여러 줄로 분해** — `mouseAction`을 추가하니 한 줄 import가 길어져 멀티라인이 됐다. 제 변경이 유발한 포맷 변화(인접 코드 임의 정리 아님).
3. **이벤트 순서를 코드 리뷰로 확인** — React 19가 핸들러를 루트 컨테이너에 붙이므로 `ContinuousView`의 포커스용 `onMouseDown`이 먼저, `window` 버블의 새 리스너가 나중에 실행된다. 따라서 `preventDefault()`가 포커스 획득이나 `click-zone`(버튼 0, preventDefault 대상 아님)에 영향을 주지 않는다. 플랜에 명시되지 않았던 검증 항목.

## 코드 리뷰
위험 영역(인증·데이터 변경·공개 API·마이그레이션) 미해당, 규모 작음 → 별도 리뷰 페이즈 생략(§3의 trivial 예외). 자체 diff 검토에서 발견된 문제 없음.

## 변경 파일
- `src/lib/keymap.ts` — `mouseAction(button)` 추가(3=prevFile, 4=nextFile)
- `src/lib/keymap.test.ts` — describe 1개(3 it) 추가
- `src/components/Viewer.tsx` — window `mousedown` useEffect 추가, import 멀티라인화
- `src/components/SettingsModal.tsx` — 고정 단축키 안내 1항목 추가
- `.forge/CONTEXT.md` — (그릴링 단계에서) `단축키` 항목에 마우스 바인딩 문장 추가
