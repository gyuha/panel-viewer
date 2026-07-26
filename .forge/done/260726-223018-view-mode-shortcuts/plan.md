<!-- forge-slug: view-mode-shortcuts -->
<!-- task: 15 -->
<!-- tdd: on -->
# 보기 모드 전환 단축키 — 한장(1) · 연속(2), 재지정 가능

## Goal / Non-goals
- Goal: 보기 모드를 키로 직접 지정하는 동작 2개(`modePage`=한장, `modeContinuous`=연속)를 기존 키맵/설정 모달 체계에 편입한다. 기본 커스텀 키는 `1`/`2`이며 설정 모달의 `단축키` 탭에서 재지정·해제·기본값 복원이 된다. 툴바 툴팁이 현재 지정된 키를 동적으로 노출한다.
- Non-goals:
  - **새 도움말/치트시트 화면** — 설정 모달의 `단축키` 탭이 유일한 설명 화면(그릴링 확정)
  - **모드 왕복 토글 동작** — 직접 지정 2개만 제공
  - **표준 키(재지정 불가) 부여** — `1`/`2`는 기본 커스텀 키이며 `STANDARD_KEYS`는 `[]`
  - **파일이 열려 있지 않을 때의 모드 전환** — Viewer 범위로 한정
  - Rust/영속 계층 변경 — `save_keybindings`는 `HashMap<String,String>`을 그대로 저장하므로 손댈 것이 없음
  - 키 처리 층(App 전역 / Viewer / PageView) 통합 리팩터

## Source of truth
- Glossary terms(이번 그릴링에서 갱신): `동작(Action)` — 보기 모드 전환 2가지 추가 + 누락돼 있던 `앱 종료` 보정 + 유효 범위(전역 vs 파일 열림) 명시, `단축키(Keybinding)` — 기본 커스텀 키 `1`/`2` 추가. `보기 모드(View mode)`는 기존 정의(한장/연속) 그대로. → `.forge/CONTEXT.md`
- Related ADRs: none — 직전 유사 작업(`settings-keybinding-expansion`)과 동일한 판단으로 "표준 키 고정 + 커스텀 1개" 모델의 인스턴스 추가는 가역적이고 놀랍지 않아 ADR 3조건 미달.
- 기존 코드(확장 대상, 확인 완료):
  - `src/lib/keymap.ts` — `Action` 8종 + `ACTIONS` + `ACTION_LABELS` + `STANDARD_KEYS` + `DEFAULT_CUSTOM` + `PAGE_ACTIONS`/`FILE_ACTIONS` + `actionsFor(mode)` + `resolve`/`findConflict`/`isAssignableKey`/`eventKey`.
  - `src/components/Viewer.tsx:61-79` — window keydown에서 `resolve()` 결과로 `nextFile`/`prevFile` 처리(두 모드). `MODES` 배열이 툴바 `한장`/`연속` 버튼과 `onModeChange`를 정의. `customKeys`를 이미 prop으로 받음.
  - `src/components/SettingsModal.tsx:222-286` — `ACTIONS`를 순회해 표를 그림 → **동작을 배열에 넣으면 행·캡처·충돌검사·기본값 복원이 자동으로 따라옴**.
  - `src/App.tsx:146` — `setCustomKeys({ ...DEFAULT_CUSTOM, ...(s.keybindings ?? {}) })` → 새 키가 없는 구버전 `state.json`도 기본값 `1`/`2`로 로드됨(추가 작업 불요).
  - `src/components/PageView.tsx:74` — `resolve(key, custom, "page")`를 하드코딩하되 페이지 동작 4개만 분기 → 새 동작을 `resolve`에 넣어도 **이중 처리 없음**.
  - `src/components/ContinuousView.tsx` — `resolve`를 쓰지 않고 컨테이너 포커스 + 네이티브 스크롤. Viewer 핸들러는 window 바인딩이라 포커스와 무관하게 동작.
- 결정 사항(그릴링 확정):
  1. 설명 화면 = 기존 설정 모달의 `단축키` 탭(새 화면 없음).
  2. `1`/`2`는 기본 **커스텀** 키(재지정 가능), 표준 키 아님.
  3. 독립 동작 2개(토글 없음) — 현재 모드와 무관하게 결과가 결정론적.
  4. 식별자 `modePage`/`modeContinuous` — `ViewMode` 값(`"page"`/`"continuous"`)과 접미사가 문자 그대로 일치해 매핑이 기계적. **`state.json` 키로 영속되므로 이후 개명 금지**(개명 시 사용자 지정 키 유실).
  5. 배선은 `keymap.ts`의 `MODE_ACTIONS`(두 모드 모두 유효) + `Viewer`의 기존 keydown. App 전역 아님 — 파일이 없을 때 눌리면 화면 피드백 없이 `saveViewMode`로 조용히 영속되는 문제를 피한다.
  6. 툴바 툴팁에 지정 키를 동적으로 노출(키가 비면 접미사 생략). **인접 결함인 `Viewer.tsx:88` 파일 패널 토글 툴팁의 `/` 하드코딩도 같은 헬퍼로 함께 수정**(사용자 승인).
- Definition of Done:
  - 한장 모드에서 `2` → 연속으로, 연속 모드에서 `1` → 한장으로 전환되고 **현재 페이지가 유지**된다(툴바 버튼과 동일 경로).
  - 설정 모달 `단축키` 탭에 `한장 보기`(표준 키 `—`, 커스텀 `1`)·`연속 보기`(`—`/`2`) 2행이 보이고, 다른 단일 키로 재지정·`✕`로 해제·`기본값 복원`이 모두 동작하며 충돌 검사가 `1`/`2`를 예약된 키로 거부한다.
  - 재지정한 키가 앱 재시작 후에도 유지된다(`save_keybindings` 경유). 새 키가 없는 구버전 `state.json`도 기본값 `1`/`2`로 로드된다.
  - 툴바 `한장`/`연속`/`☰` 툴팁이 현재 지정된 키를 보여주고, 설정에서 키를 바꾸면 즉시 반영된다.
  - `task check`(tsc + cargo check)와 `task test`(vitest + cargo test) 그린.

## Work slices
- [ ] S1. `keymap.ts`에 `modePage`/`modeContinuous` 추가 (TDD) — 실패 테스트부터: `ACTIONS`에 2개 포함, `ACTION_LABELS`가 `한장 보기`/`연속 보기`, `STANDARD_KEYS`가 빈 배열, `DEFAULT_CUSTOM.modePage === "1"` / `.modeContinuous === "2"`, `resolve("1", DEFAULT_CUSTOM, "continuous") === "modePage"`, `resolve("2", DEFAULT_CUSTOM, "page") === "modeContinuous"`, `findConflict("nextFile", "1", DEFAULT_CUSTOM) === "modePage"`, **회귀 가드**: `resolve("ArrowRight", c, "continuous") === null`(연속 모드에서 페이지 동작 미반환)과 `resolve(".", c, "continuous") === "nextFile"`이 그대로 유지. 구현은 `Action` 유니온·4개 상수 확장 + `MODE_ACTIONS` 상수 + `actionsFor()`가 두 모드 모두에 `MODE_ACTIONS`를 포함. — 완료 기준: `npx vitest run src/lib/keymap.test.ts` 그린(기존 테스트 무회귀) (depends: 없음)
- [ ] S2. `Viewer.tsx` 배선 — 기존 window keydown의 `resolve` 분기에 `modePage` → `onModeChange("page")`, `modeContinuous` → `onModeChange("continuous")` 추가(`e.preventDefault()` 포함, `shortcutsEnabled` 가드 유지, deps 배열에 `onModeChange` 추가). — 완료 기준: **런타임 스모크 필수**(회고 교훈: GUI 배선은 빌드·단위테스트로 안 잡힌다) — `task dev`로 파일을 열고 한장→`2`→연속→`1`→한장 왕복 시 모드가 바뀌고 페이지 번호가 유지됨, 연속 모드에서 휠 스크롤 후에도 `1`이 먹힘, 설정 모달 열림 중엔 미발동, 파일을 닫은 빈 화면에서 `1`/`2`가 아무 동작도 하지 않음 (depends: S1)
- [ ] S3. 툴팁 동적 키 — `Viewer.tsx`에 키 접미사 헬퍼(키가 `""`면 접미사 생략)를 두고 `MODES` 항목에 대응 `Action`을 실어 `한장`/`연속` 버튼 `title`에 적용, 같은 헬퍼로 `☰` 버튼의 하드코딩 `(/)`를 `customKeys.togglePanel` 기반으로 교체. — 완료 기준: `task check` 통과 + 런타임에서 세 툴팁이 `한 장씩 보기 (1)`·`연속 스크롤 보기 (2)`·`파일 목록 보이기 (/)`로 보이고, 설정에서 키를 `q`로 바꾸면 툴팁이 `(q)`로, 해제하면 접미사가 사라짐 (depends: S1, S2)
- [ ] S4. 설정 모달 확인 — 코드 변경은 원칙적으로 없음(`ACTIONS` 순회로 2행 자동 표시). 확인만: 2행 표시, 캡처·충돌 거부 메시지, `✕` 해제, `기본값 복원`, 재시작 후 영속. 추가로 **모달 높이**를 확인한다 — `App.css`의 `.modal { min-height: min(660px, 86vh) }`는 "가장 큰 단축키 탭(~653px)" 기준으로 잡힌 값인데 2행(~80px)이 늘어 이 하한을 넘긴다. 탭 전환 시 높이가 튀거나 잘리면 **`min-height` 값과 그 주석만** 갱신한다(모달 레이아웃 재설계는 범위 밖). — 완료 기준: 위 5개 항목 런타임 확인 + 탭 전환 시 높이 점프/잘림 없음 (depends: S1)
