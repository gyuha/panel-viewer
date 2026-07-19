<!-- forge-slug: settings-reading-2of3 -->
<!-- task: 11 -->
<!-- part: 2/3 -->
<!-- tdd: on -->
# 이미지 맞춤 모드 (2/3)

## Goal / Non-goals
- Goal: 보기 모드별 이미지 맞춤을 설정할 수 있게 한다. **한장 탭**: 원본 · 폭 맞추기 · 높이 맞추기 · 화면에 맞추기. **연속 탭**: 원본 · 폭 맞추기. 선택은 영속되고(state.json), 뷰어가 즉시 반영한다.
- Non-goals:
  - 파일별 개별 맞춤 — 앱 전역 설정(한장용 1개, 연속용 1개).
  - 확대/축소(줌)·회전 — 이번 범위 아님.
  - 일반 탭 동작(마지막 파일 열기·파일 이어보기) — 파트 3.

## Source of truth
- Glossary terms: 보기 모드, 페이지 — `.forge/CONTEXT.md`
- Related ADRs: none
- 기존 동작: 한장(`PageView`)=화면에 맞추기(contain, `.viewer-stage` flex 중앙), 연속(`ContinuousView`)=폭 맞추기(`.cont-img` width 100%).
- 결정 사항(그릴링 확정):
  - 두 개의 독립 설정: `pageFit`(원본/폭/높이/화면) · `continuousFit`(원본/폭). **기본값 = 현재 동작 유지**(한장=화면, 연속=폭).
  - 원본/폭/높이는 컨테이너를 넘칠 수 있으므로 해당 스테이지에 **오버플로우 스크롤** 허용.
- Definition of Done: 한장 탭에서 4종, 연속 탭에서 2종을 고르면 뷰어 렌더가 그에 맞게 바뀌고(원본=자연 크기+스크롤, 폭=가로 맞춤, 높이=세로 맞춤, 화면=contain), 재실행 후에도 선택이 유지된다.

## Work slices
- [ ] S1. 데이터 모델 (TDD) — `src-tauri/src/state.rs`: `PageFit`(원본/폭/높이/화면) · `ContinuousFit`(원본/폭) enum(serde rename) + `PersistedState`에 `#[serde(default)] page_fit`·`continuous_fit`(기본값=화면/폭). serde 라운드트립 + 구버전 JSON(필드 없음→기본값) 마이그레이션 테스트. — 완료 기준: cargo test 그린
- [ ] S2. 백엔드 저장 + api — `save_page_fit`·`save_continuous_fit` 커맨드 등록; `src/lib/api.ts`에 타입 + 래퍼 + `PersistedState` 타입 확장. — 완료 기준: cargo check + tsc 통과 (depends: S1)
- [ ] S3. 한장 렌더 — `PageView`가 `pageFit`에 따라 이미지 CSS(원본/폭/높이/화면) 적용, `.viewer-stage` 오버플로우 처리. App이 `pageFit` 상태 소유·전달·저장. — 완료 기준: 4종 전환이 화면에 반영(런타임) (depends: S2)
- [ ] S4. 연속 렌더 — `ContinuousView`가 `continuousFit`(원본/폭)에 따라 이미지 CSS 적용, 원본 시 가로 스크롤 허용. App이 상태 소유·전달·저장. — 완료 기준: 2종 전환 반영(런타임) (depends: S2)
- [ ] S5. 설정 UI — 파트 1의 한장/연속 탭에 맞춤 선택 컨트롤(세그먼트/라디오) 배선, 선택 시 저장. — 완료 기준: 탭에서 선택→저장→렌더 반영, tsc 통과 (depends: S2)
