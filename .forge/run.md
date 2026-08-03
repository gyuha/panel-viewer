# run — 페이지 탐색 슬라이더 (page-seek-slider)

실행일: 2026-08-02 · 방식: Dynamic Workflow 없이 순차 직접 실행

## 슬라이스별 결과

- S1 `scrollTopForPage` 순수 함수 test-first — ✅ 계획대로 (red 4개 확인 후 구현 → green)
- S2 `PageSeekBar` 컴포넌트 + 카운터 버튼화 — ⚠ 계획에 없던 투명 backdrop 도입
- S3 연속 모드 스크롤 통로(`forwardRef` + `useImperativeHandle`) — ✅ 계획대로
- S4 바 열림 중 키·휠 차단 — ⚠ 휠 게이트는 불필요했고(backdrop이 대신함), 대신 App에 상태를 올림

## 워크플로를 쓰지 않은 이유

슬라이스 4개 중 S2·S3·S4가 **모두 `Viewer.tsx`를 고친다**. 병렬 서브에이전트에게 같은 파일을 주면 서로의 편집을 덮어쓴다. 규모가 아니라 충돌 때문에 순차 직접 실행이 맞았다. (도메인 에이전트 없음, eco off.)

## 계획 대비 실제

### 계획대로 된 것

- S1은 TDD가 제대로 돌았다. 실패 4건(`scrollTopForPage is not a function`)을 먼저 확인하고 구현했다. 플랜이 지목한 함정 — `.continuous`에 `position`이 없어 `.cont-page`의 `offsetParent`가 컨테이너가 아니므로 `offsetTop`이 조용히 틀린다 — 은 실재했고, `getBoundingClientRect()` 차이로 계산해 회피했다.
- S3의 명령 통로는 예상대로 작았다. `initialPage`가 마운트 시점에 고정된다는 진단이 맞았고, `page` prop만으로는 스크롤되지 않는다.
- IntersectionObserver 되먹임 억제 장치는 **역시 필요 없었다**(플랜의 예측이 맞음). 드래그 중 슬라이더가 로컬 값을 쓰므로 IO가 되쏘는 `onPageChange`는 무해하고 오히려 툴바 카운터를 동기화한다.

### 벗어난 것

1. **플랜의 사실 오류 — 컴포넌트 테스트 인프라는 "없는" 게 아니라 "안 쓰인" 것이었다.**
   플랜과 그릴링(질문 10)에서 "이 저장소엔 컴포넌트 테스트 인프라가 없다, `lib/`의 순수 로직만 테스트한다"고 단정했는데 **틀렸다.** `vitest.config.ts`에 `environment: "jsdom"`, `setupFiles: ["./src/test-setup.ts"]`, `include: ["src/**/*.test.{ts,tsx}"]`(`.tsx` 명시)가 이미 있고 `@testing-library/react`·`jest-dom`도 설치돼 있다. 단지 `.tsx` 테스트가 한 개도 없었을 뿐이다.
   그 잘못된 전제 위에서 "TDD가 물 게 거의 없다"고 범위를 좁혔던 것이므로, 발견 즉시 넓혀 **컴포넌트 테스트 10개**를 추가했다(`PageSeekBar.test.tsx` 5, `Viewer.test.tsx` 5). 가장 값이 큰 두 함정 — Esc가 파일을 통째로 닫는 것, 화살표 키 이중 발동 — 이 정확히 여기서 잡힌다.

2. **S4의 `ContinuousView` 휠 게이트를 만들지 않았다.**
   플랜은 "`ContinuousView`의 휠 핸들러에도 게이트를 신설해야 한다(2줄)"고 지시했으나 **불필요했다.** 투명 backdrop이 `.viewer` 안에서 `position:absolute; inset:0; z-index:1`로 깔리는데, `.continuous`의 wheel 리스너는 그 컨테이너에 붙어 있고 backdrop은 **형제**라 이벤트 경로에 들어가지 않는다. 같은 이유로 `PageView`의 `.viewer-stage` 휠도 죽는다. 완료 기준("두 모드 모두 휠 무반응")은 다른 수단으로 충족되며, 게이트를 넣었으면 도달 불가능한 죽은 코드가 됐다.
   **단, 이건 코드 추론이지 실측이 아니다.** UAT 5번에서 반드시 확인할 것.

3. **`seekOpen` 상태를 App으로 올렸다(플랜엔 Viewer 로컬이 암시돼 있었다).**
   `App.tsx:184`의 전역 핸들러가 커스텀 키 `quitApp`(기본 `x`)와 `togglePanel`을 처리하는데 **`settingsOpen`만 보고 있었다.** 슬라이더를 조작하다 `x`를 누르면 앱이 종료된다. 플랜의 S4 목록엔 이 핸들러가 없었지만 "기존 키 전면 차단"의 취지에 들어가고, 종료는 명백한 손실이라 포함했다.

4. **게이트 소유권을 다시 나눴다(중간에 한 번 되돌림).**
   처음엔 App이 `shortcutsEnabled={!settingsOpen && !seekOpen}`을 계산했는데, 그러면 `Viewer.test.tsx`의 이중 발동 테스트가 **허수**가 된다 — 테스트가 그 조합을 직접 만들어 넣으므로 App이 `!seekOpen`을 빠뜨려도 통과한다. 그래서 App은 `!settingsOpen`만(원래대로) 내려보내고 Viewer가 `keysLive = shortcutsEnabled && !seekOpen`을 스스로 계산하게 바꿨다. 게이트마다 소유자가 하나씩이고, 테스트가 실제로 문다.
   **뮤테이션으로 검증함**: `!seekOpen`을 빼면 해당 테스트 1개만 실패하고, 되돌리면 통과한다.

5. **투명 backdrop은 플랜에 없던 요소다.**
   "바깥 클릭 닫기"를 구현하다 발견한 문제: `PageView.tsx:111-112`의 좌우 클릭 존은 `<button onClick>`이라 `shortcutsEnabled` 게이트 대상이 **아니다.** backdrop 없이 바깥을 클릭하면 바가 닫히면서 **동시에 페이지가 넘어간다.** backdrop 하나가 이 문제와 위 2번(휠 차단)을 함께 해결했다.

6. `Viewer`를 `forwardRef`로 감싸는 대신 `ContinuousViewImpl` + `forwardRef(...)` 형태로 분리했다. 컴포넌트 본문 전체가 한 단계 들여쓰기 밀리는 걸 피해 diff를 작게 유지하기 위함.

7. 파일을 닫을 때(`onClose`) `seekOpen`을 리셋하도록 추가했다 — 내 변경이 만든 잔여 상태 정리.

## 알려진 미해결 엣지 (고치지 않음, 판단 근거 포함)

**휠 관성 애니메이션과 스크럽의 경합.** `ContinuousView.tsx`의 휠 핸들러는 rAF 루프로 관성 스크롤을 돌리는데(`animating`/`raf`는 마운트 이펙트 내부 지역 변수), 이 루프는 `keydown`에서만 중단된다(`stopAnim`). 휠을 굴린 직후 관성이 남아 있는 동안(≈300~500ms) 카운터를 눌러 바를 열고 바로 드래그하면, rAF tick이 `scrollTop`을 목표값으로 되돌려 첫 스크럽을 무를 수 있다.

고치지 않은 이유: `animating`/`raf`를 ref로 올려야 하는데, 이 스크롤 루프는 주석이 과거 버그들("도달 불가한 target에 갇혀 키 스크롤이 계속 죽는다")을 명시할 만큼 손이 많이 탄 자리다. **실측된 실패 없이** 건드리면 그 주석이 경고하는 영역에서 회귀를 만들 위험이 이득보다 크다. UAT 항목으로 돌린다.

## 검증 결과

- `npx tsc --noEmit` → 0
- `cd src-tauri && cargo check` → Finished (Rust 무변경)
- `npx vitest run` → **60개 통과** (기존 50 + 신규 10)
- `npx vite build` → 성공

## 코드 리뷰 판단

인증·데이터 변경·공개 API·마이그레이션 어디에도 닿지 않는 프런트엔드 UI 배선이고, 최대 위험 두 가지(Esc 파일 닫힘, 키 이중 발동)는 뮤테이션까지 확인한 테스트로 고정했다. 별도 리뷰 페이즈는 과하다고 판단해 생략했다. (사용자 지침상 서브에이전트 미사용.)
