# run — 일반 탭 동작: 마지막 파일 열기 + 파일 이어보기 (3/3)

## 계획 대비 실제 — 계획대로 (+통합 결정 몇 건)

### S1. 데이터 모델 + 경계 판단 (TDD)
- `state.rs`: `last_file: Option<String>` · `open_last_file: bool`(기본 true) · `seamless: bool`(기본 false). open_last_file 기본 true를 위해 **PersistedState의 derive Default 제거 + 수동 impl Default**(구버전 JSON은 serde `default = "default_true"`로도 true 보장). round_trip 리터럴에 3필드 추가.
- `nav.ts`: `seamlessTurn(page,pageCount,dir,seamless,hasPrev,hasNext) -> {kind:"page"|"file"|"none"}` 순수 함수 + 5 테스트. state 3 테스트.
- red → 구현 → green(nav 13, state 11).

### S2. 백엔드 저장 + api
- `lib.rs`: `save_last_file`·`save_open_last_file`·`save_seamless` 커맨드 + 등록.
- `api.ts`: 래퍼 3개 + `PersistedState`에 `lastFile`·`openLastFile`·`seamless`.

### S3. 마지막 파일 열기
- `App` 시작 복원 효과에 통합: loadState 후 `takePendingFile()` 대기 파일 우선, 없으면 `openLastFile && lastFile`이면 `openPath(lastFile, {silent:true})`. 파일 연결 이벤트 효과는 `listen("open-archive")`만 남김(대기 파일 초기 소비는 복원 효과로 이동).
- `openPath`에 `opts {atLastPage?, silent?}` 추가 + 성공 시 `saveLastFile(canonical)`. silent면 실패해도 에러 배너 없이 스킵.

### S4. 파일 이어보기 — 한장
- `PageView` goNext/goPrev가 `seamlessTurn`으로 판단: 경계 아니면 페이지 이동, 경계+이어보기+인접 있으면 `onOpenAdjacent(dir)`. 키/클릭/휠 모두 goNext/goPrev 경유라 일괄 적용.
- App `onOpenAdjacent(dir)`: dir 1→다음 파일, dir -1→이전 파일 `{atLastPage:true}`(마지막 페이지부터).

### S5. 파일 이어보기 — 연속
- `ContinuousView`: 컨테이너 wheel 리스너(passive) — 쿨다운(500ms) 후 맨 아래+휠다운→`onOpenAdjacent(1)`, 맨 위+휠업→`onOpenAdjacent(-1)`.

### S6. 설정 UI
- `SettingsModal` 일반 탭에 "마지막 파일 열기"·"파일 이어보기" 체크박스 토글 + 설명. App이 상태 소유·로드·저장, Viewer→PageView/ContinuousView로 seamless·onOpenAdjacent 전달.

## 검증 (UAT)
- 단위: cargo test 20(reading_options serde/마이그레이션 신규), vitest 35(seamlessTurn 5 신규), tsc 모두 green. tsc가 App→Viewer→PageView/ContinuousView·SettingsModal 프롭 정합성 검증.
- 런타임 스모크(마지막 파일 열기): state.json에 lastFile 선주입 후 콜드 실행 → **사용자 입력 없이 pvpage idx 요청 발생**(연속 모드에서 마지막 파일을 읽던 위치 ~20페이지로 복원 → idx 16~27 lazy 로딩 패턴). = 자동 열기 + 읽던 위치 복원 end-to-end 확인.

## 즉석 결정
- `openPath`에 opts(atLastPage/silent) 도입 — 이어보기-이전(마지막 페이지)·자동열기(조용한 실패) 공용.
- 시작 시 대기파일 소비를 복원 효과로 이동(open_last_file/last_file를 `s`에서 직접 읽어 경합 제거).

## 유의(수동 UAT)
- **파일 이어보기 실제 파일 간 전환**: 픽스처 폴더에 아카이브가 하나뿐이라 스모크 불가 → 경계 판단은 TDD(seamlessTurn 5), 배선은 tsc/리뷰로 확인. 실제 폴더(≥2 파일)에서 한장 마지막→다음 파일, 첫→이전 파일(마지막 페이지), 연속 맨아래 휠→다음 파일 육안 확인 권장.
- 일반 탭 토글 표시·저장, 마지막 파일이 없어졌을 때 조용한 스킵도 육안 확인 권장.
