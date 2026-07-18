# run — 설정(단축키) 확장: 앱 종료 재지정 + 메뉴 열기(Cmd+,)

## 계획 대비 실제

### S1. keymap.ts에 quitApp 동작 추가 (TDD) — 계획대로
- `src/lib/keymap.ts`: `Action`/`ACTIONS`/`ACTION_LABELS`("앱 종료")/`STANDARD_KEYS`([])/`DEFAULT_CUSTOM`("x")에 `quitApp` 추가.
- `quitApp`은 `PAGE_ACTIONS`/`FILE_ACTIONS`에 미포함 → `resolve`는 반환하지 않음(App 전역 처리, togglePanel과 동일). `findConflict`는 ACTIONS 순회로 "x"를 예약.
- 테스트 우선: `keymap.test.ts`에 3케이스(ACTIONS 포함+기본키 x / resolve 미반환 / findConflict x→quitApp) 추가 → red 확인 → 구현 → green.
- 완료 기준(vitest 그린) 충족: keymap 18개(기존 15 + 신규 3), 전체 30개.

### S2. App.tsx 전역 디스패치 — 계획대로 (+수식 키 가드 1건)
- 전역 keydown: (1) `e.metaKey && e.key === ","` → `preventDefault` + `setSettingsOpen(true)`(메뉴 열기 고정), (2) `customKeys.quitApp !== "" && e.key === customKeys.quitApp` → `quitApp()`. 기존 하드코딩 `e.key === "x"` 제거.
- **즉석 결정**: 단일 키 커스텀 매칭 전에 `if (e.metaKey||e.ctrlKey||e.altKey) return` 가드 추가 → Cmd+x 등 조합키로 종료/토글 오발동 방지. (계획엔 명시 안 됐으나 합리적 보강)
- 설정 모달 열림 중 미발동 가드 유지. loadState 병합으로 quitApp 기본값 x 보장(구버전 state.json 호환).

### S3. SettingsModal 표시 — 계획대로
- "앱 종료" 행은 ACTIONS 확장으로 편집 가능 행 자동 표시.
- 표 아래에 "고정 단축키" 안내(`⌘ ,` 메뉴 열기 · `Esc` 닫기) 추가. `.fixed-keys` 스타일(App.css)로 kbd 박스 표시.

## 검증 (UAT)
- 단위: vitest 30개(quitApp 3 신규 포함), tsc, cargo check 모두 green.
- 런타임 스모크(합성 x 디스패치): `[SMOKE] quit_app called` 발화 + dev code=0 정상 종료 → 합성 x → App 전역 핸들러 → customKeys.quitApp("x") → quitApp() → 백엔드 quit_app → app.exit(0) 전 과정 확인(x→종료 리팩터 경로 end-to-end).
- Cmd+, → 설정: 합성 이벤트로는 네이티브 메뉴 우회라 가로채기 확인 불가. 대신 **커스텀 메뉴 정의 없음 확인**(src-tauri/src에 Menu 없음) → 기본 Tauri 메뉴엔 Cmd+, 미바인딩 → keydown이 웹뷰로 도달 [높음]. 핸들러 코드 정상(tsc). 시각 확인은 수동 권장.
- 임시 진단 2곳(quit_app eprintln, App 합성 dispatch) 제거 확인(grep 깨끗).

## 즉석 결정
- 조합키 가드(위 S2) — 단일 키 커스텀 동작은 수식 키 없이만 발동.

## 막힌 곳 / 유의(수동 UAT)
- **Cmd+,로 설정 모달 열림** — 기계로 최종 확인 불가(합성=네이티브 우회). 기본 메뉴 미바인딩 근거로 동작 예상이나 `task dev`에서 실제 Cmd+, 눌러 확인 권장. 만약 가로채이면 네이티브 메뉴에 Preferences 항목 추가가 대안.
- 설정 모달의 "앱 종료" 편집 행 + "고정 단축키" 안내 표시 — 육안 확인 권장(코드상 자동 렌더).
