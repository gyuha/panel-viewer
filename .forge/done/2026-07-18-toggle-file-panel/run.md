<!-- forge-slug: toggle-file-panel -->
# RUN — 파일 목록 패널 표시/숨김 토글 (toggle-file-panel)

## 계획대로 된 것
- **S1 키맵에 '패널 토글' 추가(TDD)**: `keymap.ts`에 `togglePanel`(표준 키 없음, 기본 커스텀 키 `/`) 추가. `findConflict`가 `/`·togglePanel을 예약으로 커버(다른 동작이 `/`를 못 뺏음), `resolve`(모드 필터)는 togglePanel 미반환 → App 전역에서 별도 처리. Vitest 15개 그린(신규 3개 포함).
- **S2 Rust 패널 숨김 영속(TDD)**: `state.rs` PersistedState에 `panel_hidden`(bool, serde default false) + `save_panel_hidden` 커맨드. cargo 테스트 5개 그린(왕복 + 필드 없는 구버전 JSON→false).
- **S3 토글 로직 + 전역 '/' 배선**: App이 `panelHidden`을 시작 시 복원해 보유, `togglePanel`(상태 반전 + 저장). App 레벨 전역 keydown이 `customKeys.togglePanel` 키 → 토글(설정 모달 열림 중 미발동). `panelHidden`이면 FilePanel 미렌더 → `app-main`이 전체 폭.
- **S4 좌상단 토글 아이콘**: 항상 보이는 토글 버튼(☰) — 패널 보임=패널 헤더(`.panel-head`), 숨김=뷰어 툴바 맨 앞 / 빈 화면 좌상단. 어느 상태(읽는 중·빈 화면 × 보임·숨김)에서도 정확히 하나만 보이도록 조건부 렌더.

## 계획과 달라진 점 / 현장 결정 (낮음)
- **impure 업데이터 수정**: 처음엔 `setPanelHidden(prev => { savePanelHidden(next); return next })`로 썼는데, 런타임 검증에서 StrictMode가 업데이터를 이중 호출해 `save_panel_hidden`이 2번씩 찍힘(기능은 정상, 같은 값). 부수효과를 업데이터 밖으로 빼 `const next = !panelHidden; setPanelHidden(next); save(next)` (deps `[panelHidden]`)로 정정 → 1회 호출 확인.
- 패널 헤더 신설(`.panel-head`)로 기존 `.panel-path`를 토글 버튼과 한 행에 배치(경로의 border-bottom을 헤더로 이동).

## 검증 범위
- **기계 검증됨**: cargo test 14 · vitest 18(nav 3 + keymap 15) · `tsc && vite build` · `cargo build` 그린. **전역 '/' 토글 런타임 확인**: 빈 화면(파일 안 열림)에서 `/`→숨김(true), 다시 `/`→표시(false), 각 1회 영속.
- **사용자 수동 확인 필요(플랜 S4 기준)**: 좌상단 ☰ 아이콘의 실제 표시(4가지 상태: 읽는 중·빈 화면 × 보임·숨김)와 클릭 토글, 설정 모달에 '파일 패널 토글' 표시·재지정, 재시작 후 숨김 상태 복원. (키맵 충돌·상태 왕복은 단위 테스트로 커버.)

## 코드 리뷰
- 위험 영역 아님. 상태 필드 추가는 하위호환(serde default + 구버전 JSON 테스트). 별도 적대적 리뷰 생략.
