<!-- forge-slug: settings-keybinding-expansion -->
<!-- task: 9 -->
<!-- tdd: on -->
# 설정(단축키) 확장 — 앱 종료 재지정 + 메뉴 열기(Cmd+,)

## Goal / Non-goals
- Goal: 기존 설정 모달/키맵을 확장해 요청한 매핑 대상을 갖춘다 — 이전화·다음화(기존)에 더해 **앱 종료(닫기)** 를 재지정 가능한 동작으로 추가(기본 키 `x`), **메뉴 열기**를 macOS 표준 **Cmd+, 고정** 단축키로 설정 모달에 연결.
- Non-goals:
  - 모디파이어 조합 키의 **일반 지원**(Cmd+, 이외) — 키맵은 단일 키 체계 유지
  - **메뉴 열기 재지정** — Cmd+, 고정(관례)
  - 아카이브 닫기(Esc→브라우저) 재지정 또는 동작 변경
  - nextFile/prevFile UI 라벨을 "이전화/다음화"로 변경(별도 요청 시)
  - 설정 화면 다중 카테고리/재설계(향후)

## Source of truth
- Glossary terms: 동작(Action), 단축키(Keybinding), 보기 모드 — `.forge/CONTEXT.md`(새 용어 없음; "앱 종료·메뉴 열기"는 기존 동작 개념의 인스턴스)
- Related ADRs: none (Cmd+, 고정은 macOS 관례로 설명 가능 — ADR 3조건 미충족)
- 기존 코드(확장 대상):
  - `src/lib/keymap.ts` — Action 7종 + STANDARD_KEYS(고정) + DEFAULT_CUSTOM(nextFile "." · prevFile "," · togglePanel "/") + `resolve`(모드별, togglePanel·전역동작은 미반환) + `findConflict` + `isAssignableKey`(조합키·Esc 거부).
  - `src/components/SettingsModal.tsx` — ACTIONS 표(동작·표준 키·커스텀 키) + 기본값 복원. 파일 패널 하단 버튼으로 열림.
  - 하드코딩 상태: App 전역 keydown의 `x`→종료, Viewer의 `Esc`→아카이브 닫기.
- 결정 사항(그릴링 확정):
  - **기존 모달 확장**(새 화면 아님).
  - **닫기 = 앱 종료(quit)**. `quitApp` 동작을 keymap에 편입(재지정 가능, 기본 키 `x`). 아카이브 닫기(Esc)는 그대로.
  - **메뉴 열기 = Cmd+, 고정**(재지정 불가). App 전역 핸들러에서 `metaKey && ","` → 설정 모달 열기.
  - 이전화=nextFile, 다음화=prevFile(이미 재지정 가능) — 그대로.
  - 설정 모달에 **고정 단축키 안내**(⌘,=메뉴 열기, Esc=닫기) 표시.
- Definition of Done: 설정 모달에 "앱 종료" 행이 나타나 기본 키 x로 종료되고 다른 단일 키로 재지정 가능(충돌 검사 포함); Cmd+,로 설정 모달이 열림; 모달에 고정 단축키(⌘,·Esc) 안내 표시; 기존 하드코딩 `x`는 제거되고 `customKeys.quitApp`으로 대체; 구버전 state.json(quitApp 키 없음)도 기본값 x로 로드.

## Work slices
- [ ] S1. keymap.ts에 `quitApp` 동작 추가 (TDD) — `Action`/`ACTIONS`/`ACTION_LABELS`("앱 종료")/`STANDARD_KEYS`([])/`DEFAULT_CUSTOM`("x") 확장. `quitApp`은 전역 동작이라 `PAGE_ACTIONS`/`FILE_ACTIONS`에 넣지 않아 `resolve`는 이를 반환하지 않음(App이 직접 처리, togglePanel과 동일); `findConflict`는 ACTIONS 순회로 x를 예약. `keymap.test.ts` 확장: DEFAULT_CUSTOM.quitApp==="x", resolve가 quitApp 미반환, findConflict가 x를 quitApp로 예약. — 완료 기준: vitest 그린 (depends: 없음)
- [ ] S2. App.tsx 전역 디스패치 — 전역 keydown에 (1) `e.metaKey && e.key === ","` → `e.preventDefault()` + 설정 모달 열기(고정), (2) `customKeys.quitApp !== "" && e.key === customKeys.quitApp` → `quitApp()`(기존 하드코딩 `e.key === "x"` 제거). 설정 모달 열림 중 미발동 가드 유지. `loadState` 병합(`{...DEFAULT_CUSTOM, ...saved}`)으로 quitApp 기본값 x 보장. — 완료 기준: Cmd+,로 설정 열림 + x로 종료 + 재지정 반영(런타임 확인); Cmd+,가 네이티브 메뉴에 안 먹히고 JS로 도달하는지 확인 (depends: S1)
- [ ] S3. SettingsModal 표시 — "앱 종료" 행은 ACTIONS 확장으로 자동 표시(편집 가능). 표 아래(또는 위)에 "고정 단축키" 안내 영역 추가: `⌘,` = 메뉴 열기(설정), `Esc` = 닫기(아카이브). 표시 전용. — 완료 기준: 모달에 앱 종료 편집 행 + 고정 단축키 안내가 보이고 tsc 통과 (depends: S1)
