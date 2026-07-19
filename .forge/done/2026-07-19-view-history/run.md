# run — 히스토리(열람 기록) 기능

## 계획 대비 실제 — 모두 계획대로

### S1. 데이터 모델 + 기록 리듀서 (TDD)
- `state.rs`: `HistoryEntry { path, name, opened_at: u64 }`(camelCase) + `PersistedState.history: Vec<HistoryEntry>`(serde default) + 수동 Default에 빈 Vec. 순수 `push_history(history, entry, cap)`(같은 path 제거→맨 앞→cap truncate).
- 테스트 우선: 중복→맨위·시각갱신, cap 초과→최오래된 제거, 구버전 JSON→빈 history → red → 구현 → green(state 13).

### S2. 백엔드 커맨드 + api
- `lib.rs`: `record_history(path)`(name=file_name, opened_at=SystemTime now ms, `push_history` cap 500, save) · `delete_history(path)` · `reset_history()` + 등록.
- `api.ts`: `HistoryEntry` 타입 + `recordHistory`·`deleteHistory`·`resetHistory` + `PersistedState.history`.

### S3. App 배선
- 시작 시 `history` 로드. `openPath` 성공 시 `recordHistory(canonical)` + 로컬 미러(중복 제거→맨 위→상한 500, `basename`/`Date.now`)로 즉시 반영. delete/reset 핸들러(상태+저장). FilePanel에 history·핸들러 전달(열기는 기존 onOpenFile=openPath 재사용).

### S4. FilePanel 히스토리 뷰
- 패널 탭(폴더 ↔ 히스토리). 히스토리 모드: 최신순 목록, 페이지당 20(이전/다음 페이징), 각 항목 클릭→열기 + ✕ 삭제, 하단 리셋(인라인 "예/아니오" 확인). 파일명+짧은 날짜/시각, 경로 툴팁. `.panel-tabs`/`.hist-*` CSS 추가.

## 검증 (UAT)
- 단위: cargo test 22(push_history 중복·cap + history serde/마이그레이션 신규 2), vitest 35, tsc 모두 green.
- 런타임 스모크(기록 경로): 픽스처 자동 열기 → state.json `history`에 `{path, name:"sample.cbr", openedAt:<ms>}` 저장 확인 = openPath→recordHistory→record_history→push_history→save end-to-end.
- 임시 진단(자동 열기) 제거 확인, state.json 백업 복원.

## 즉석 결정
- 히스토리 클릭 열기는 새 콜백 대신 기존 `onOpenFile`(=openPath) 재사용 — "현재 폴더 이동"도 openPath가 이미 처리하므로 별도 구현 없음(계획의 Non-goals와 일치).
- 리셋 확인은 window.confirm 대신 인라인 "예/아니오"(웹뷰 confirm 신뢰성 회피).

## 유의(수동 UAT — GUI)
- 폴더↔히스토리 탭 전환, 목록 최신순 표시, 항목 클릭→열기(+현재 폴더 이동), ✕ 개별 삭제, 하단 리셋(확인), 20개 초과 시 페이징 — `task dev`로 육안 확인 권장.
- 상한 500 초과 동작은 로직(push_history) 단위 테스트로 검증(수동 재현 어려움).
