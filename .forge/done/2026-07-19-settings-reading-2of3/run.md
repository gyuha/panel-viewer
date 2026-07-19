# run — 이미지 맞춤 모드 (2/3)

## 계획 대비 실제 — 모두 계획대로

### S1. 데이터 모델 (TDD)
- `state.rs`: `PageFit`(original/width/height/screen, 기본 screen) · `ContinuousFit`(original/width, 기본 width) enum(serde rename) + `PersistedState.page_fit`·`continuous_fit`(serde default). round_trip 테스트 리터럴에도 필드 추가.
- 테스트 우선: 기본값·라운드트립·serde 값 이름·구버전 마이그레이션 → red → 구현 → green(state 10개).

### S2. 백엔드 저장 + api
- `lib.rs`: `save_page_fit`·`save_continuous_fit` 커맨드 + invoke_handler 등록.
- `api.ts`: `PageFit`·`ContinuousFit` 타입, `savePageFit`·`saveContinuousFit` 래퍼, `PersistedState`에 `pageFit`·`continuousFit`.

### S3. 한장 렌더
- `PageView`에 `fit: PageFit` prop, `.viewer-stage fit-${fit}` 클래스. `App.css`: fit-width(폭100%·세로스크롤), fit-height(높이100%·가로스크롤), fit-original(자연크기·양방향스크롤), fit-screen(contain, 기본).

### S4. 연속 렌더
- `ContinuousView`에 `fit: ContinuousFit` prop, `.continuous fit-${fit}` 클래스. 원본=자연크기+가로스크롤, 폭=기본(width 100% max 900px).

### S5. 설정 UI
- `SettingsModal` 한장 탭=4종, 연속 탭=2종 세그먼트 컨트롤(`Segmented`) + `.seg`/`.setting-row` 스타일. App이 `pageFit`/`continuousFit` 상태 소유·로드·저장, Viewer→PageView/ContinuousView로 전달.

## 검증 (UAT)
- 단위: cargo test 19개(fit enum/serde 마이그레이션 신규 1 포함), tsc, vitest 30 모두 green. tsc가 모든 prop 타입(App→Viewer→PageView/ContinuousView, SettingsModal) 정합성 검증.
- 렌더는 `fit-${fit}` 클래스 배선으로 CSS 적용 — 코드/타입 확인 완료.

## 유의(수동 UAT — 시각)
- **실제 맞춤 모양은 육안 확인 필요**(기계 판정 불가): 한장 원본/폭/높이/화면 4종, 연속 원본/폭 2종이 의도대로 보이는지, 넘칠 때 스크롤되는지, 재실행 후 유지되는지.
- **알려진 제한**: 한장 스크롤 맞춤(원본/폭/높이)에서 좌우 클릭 영역(page-turn 오버레이)이 스크롤 콘텐츠와 겹칠 수 있음 — 페이지 넘김은 키/휠로도 가능. 필요 시 후속 조정.
