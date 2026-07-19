<!-- forge-slug: view-history -->
<!-- task: 13 -->
<!-- tdd: on -->
# 히스토리(열람 기록) 기능

## Goal / Non-goals
- Goal: 지금까지 연 코믹 아카이브를 최신순으로 보여주는 **히스토리**를 만든다. 파일 패널을 폴더 목록 ↔ 히스토리로 전환할 수 있고, 히스토리 항목을 클릭하면 그 파일을 열고(현재 폴더도 그 폴더로 이동), 항목별 삭제 · 하단 전체 리셋 · 페이징을 제공한다.
- Non-goals:
  - 열람 로그(같은 파일 중복 항목) — 파일당 1개(재열람 시 시각 갱신+맨 위)
  - 폴더/이미지 파일 히스토리 — 아카이브 열기만 기록
  - 히스토리 검색/필터, 없어진 파일 자동 제거, 서버측 페이징
  - "현재 폴더 이동"의 새 구현 — 기존 `openPath`가 이미 현재 폴더를 연 파일 폴더로 동기화함

## Source of truth
- Glossary terms: **히스토리**, 읽던 위치, 현재 폴더 — `.forge/CONTEXT.md`
- Related ADRs: none (state.json 확장은 관례적)
- 기존 코드: `state.rs` `PersistedState`(+수동 Default), `App.openPath`(열기 성공 시 현재 폴더 동기화·canonical 경로), `FilePanel`(현재 폴더 단일 뷰, panel-head/list/foot), `folder.ts` basename.
- 결정 사항(그릴링 확정):
  - **위치**: 파일 패널 뷰 전환(폴더 목록 ↔ 히스토리).
  - **중복**: 파일당 1개, 재열람 시 시각 갱신 후 맨 위.
  - **상한 500개**(초과 시 가장 오래된 항목 제거).
  - **페이징**: 클라이언트 측(전량 로드 후 UI 분할), 페이지당 20개.
  - **기록 시점**: 아카이브 열기(`openPath`) 성공마다(파일 연결·드래그·마지막 파일·이어보기 포함).
  - **삭제**: 개별 항목 즉시(✕), 리셋(전체 삭제)은 확인 후.
  - **표시**: 파일명 + 짧은 날짜/시각, 전체 경로는 툴팁. 없어진 파일 클릭 시 기존 openPath 에러 표시(항목 유지).
- Definition of Done: 파일 패널을 히스토리로 전환하면 연 파일이 최신순으로 나오고, 클릭 시 그 파일이 열리며 현재 폴더도 이동한다. 항목별 ✕ 삭제, 하단 리셋(확인)으로 전체 삭제, 20개 초과 시 페이징된다. 상한 500개가 지켜지고 재실행 후에도 유지된다.

## Work slices
- [ ] S1. 데이터 모델 + 기록 리듀서 (TDD) — `state.rs`: `HistoryEntry { path, name, opened_at: u64 }` + `PersistedState`에 `#[serde(default)] history: Vec<HistoryEntry>`(수동 Default에 빈 Vec). 순수 `push_history(history, entry, cap) -> Vec`(같은 path 제거→맨 앞 삽입→cap truncate). — 완료 기준: cargo test 그린(중복→맨위, cap 초과→최오래된 제거, 신규 추가, 구버전 JSON→빈 history 마이그레이션)
- [ ] S2. 백엔드 커맨드 + api — `lib.rs`: `record_history(path)`(name=file_name, opened_at=현재 millis, `push_history` cap 500, save) · `delete_history(path)` · `reset_history()` + 등록. `api.ts`: `HistoryEntry` 타입 + `recordHistory`·`deleteHistory`·`resetHistory` 래퍼 + `PersistedState.history`. — 완료 기준: cargo check + tsc (depends: S1)
- [ ] S3. App 배선 — 시작 시 `history` 상태 로드; `openPath` 성공 시 `recordHistory(canonical)` + 로컬 history 갱신(즉시 반영); delete/reset 핸들러(상태+저장). FilePanel에 history·핸들러·onOpenFile 전달. — 완료 기준: tsc + 열기→기록, 삭제·리셋이 목록에 반영(런타임) (depends: S2)
- [ ] S4. FilePanel 히스토리 뷰 — 패널 뷰 토글(폴더↔히스토리). 히스토리 모드: 최신순 목록(페이지당 20, 이전/다음 페이징), 각 항목 클릭→열기 + ✕ 삭제, 하단 리셋(확인 후). 파일명+짧은 날짜/시각, 경로 툴팁. + CSS. — 완료 기준: tsc + 토글·클릭 열기·삭제·리셋·페이징 동작(런타임) (depends: S3)
