<!-- forge-slug: settings-reading-3of3 -->
<!-- task: 12 -->
<!-- part: 3/3 -->
<!-- tdd: on -->
# 일반 탭 동작: 마지막 파일 열기 + 파일 이어보기 (3/3)

## Goal / Non-goals
- Goal: **일반 탭**에 두 토글을 추가하고 동작을 구현한다.
  - **마지막 파일 열기**(기본 ON): 앱을 그냥 실행(파일 연결·드래그 아님)했을 때 마지막에 읽던 파일을 자동으로 연다.
  - **파일 이어보기**(토글): 마지막 페이지에서 다음으로 넘어가면 다음 파일을, 첫 페이지에서 이전으로 넘어가면 이전 파일(의 마지막 페이지)을 자동으로 연다. 한장·연속 두 모드 모두.
- Non-goals:
  - 폴더 경계를 넘는 이어보기 — 현재 폴더의 아카이브 목록 안에서만.
  - Esc로 브라우저 복귀 후 재자동열기 — 마지막 파일 열기는 콜드 실행 시에만.

## Source of truth
- Glossary terms: **파일 이어보기**, 현재 폴더, 읽던 위치 — `.forge/CONTEXT.md`
- Related ADRs: none
- 기존 코드: `App.openPath`(재진입 가드·현재 폴더 동기화·읽던 위치 복원), `folderArchives`+`indexInFolder`로 이전/다음 파일 계산, `PageView.goNext/goPrev`(nextPage/prevPage 클램프), `ContinuousView`(스크롤+IntersectionObserver), `takePendingFile`/`open-archive`(파일 연결).
- 결정 사항(그릴링 확정):
  - **마지막 파일 열기**: `last_file`(마지막 연 아카이브 절대경로)를 open 시 저장. 콜드 실행에서 대기 파일(연결/드래그) 없고 옵션 ON이면 `last_file` 열기. 파일이 없어졌으면 조용히 스킵(빈 화면). Esc로 닫은 뒤엔 재자동열기 안 함.
  - **파일 이어보기 트리거**: 한장 = 마지막 페이지에서 다음(키/클릭/휠) → 다음 파일 첫 페이지, 첫 페이지에서 이전 → 이전 파일 **마지막 페이지**. 연속 = 맨 아래 도달 상태에서 추가 휠/스크롤다운 → 다음 파일, 맨 위에서 추가 휠/스크롤업 → 이전 파일.
  - 경계에 인접 파일이 없으면(목록의 처음/끝) 아무 일 없음(클램프).
- Definition of Done: 일반 탭에서 두 토글이 보이고 영속된다. 마지막 파일 열기 ON에서 앱을 그냥 켜면 마지막 파일이 열린다(없으면 빈 화면). 파일 이어보기 ON에서 한장 마지막 페이지 다음→다음 파일, 첫 페이지 이전→이전 파일 마지막 페이지; 연속 맨 아래 추가 스크롤→다음 파일이 열린다.

## Work slices
- [ ] S1. 데이터 모델 + 경계 판단 순수 로직 (TDD) — `state.rs`: `#[serde(default)] last_file: Option<String>`·`open_last_file: bool`(기본 true)·`seamless: bool`(기본 false) + serde 마이그레이션 테스트. `src/lib/nav.ts`에 이어보기 경계 판단 순수 함수(예: `seamlessTurn(page, pageCount, dir, hasPrev, hasNext)` → `{kind:"page"|"file"|"none", ...}`) + 테스트(마지막/첫/중간·인접 없음). — 완료 기준: cargo test + vitest 그린
- [ ] S2. 백엔드 저장 + api — `save_open_last_file`·`save_seamless` 커맨드 + `open_archive`(또는 별도 커맨드)에서 `last_file` 저장; api 래퍼 + 타입 확장. — 완료 기준: cargo check + tsc 통과 (depends: S1)
- [ ] S3. 마지막 파일 열기 — App 시작 시 대기 파일(`take_pending_file`) 없고 `open_last_file`이면 `last_file` 열기(없으면 스킵). `openPath` 성공 시 `last_file` 저장. — 완료 기준: 콜드 실행 자동 열기 + 파일 연결 우선 + 없는 파일 스킵(런타임) (depends: S2)
- [ ] S4. 파일 이어보기 — 한장 — `PageView` goNext/goPrev가 경계에서 seamless면 App의 인접 파일 열기 콜백 호출(이전 방향은 대상 파일을 마지막 페이지로 시작). `openPath`에 "마지막 페이지로 시작" 옵션 추가. — 완료 기준: 한장 경계에서 인접 파일 자동 열림, 이전은 마지막 페이지(런타임) (depends: S1)
- [ ] S5. 파일 이어보기 — 연속 — `ContinuousView`가 맨 아래/맨 위 도달 상태에서 추가 휠/스크롤 입력 시 App 콜백으로 다음/이전 파일 열기(쿨다운으로 오발동 방지). — 완료 기준: 연속 경계에서 추가 스크롤/휠→인접 파일(런타임) (depends: S1)
- [ ] S6. 설정 UI — 일반 탭에 "마지막 파일 열기"·"파일 이어보기" 토글 배선(선택 시 저장). — 완료 기준: 토글 표시·저장·동작 반영, tsc 통과 (depends: S2)
