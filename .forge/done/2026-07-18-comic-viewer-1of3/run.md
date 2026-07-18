<!-- forge-slug: comic-viewer-1of3 -->
# RUN — 코어 뷰어 (comic-viewer-1of3)

## 계획대로 된 것
- **S1 스캐폴딩**: `npm create tauri-app`(react-ts, Tauri 2)로 생성 후 기존 리포(.git/.forge/DESIGN.md 보존)에 병합. `panel-viewer` 식별자로 rename. DESIGN.md 토큰을 `src/theme.css` CSS 변수로 세팅(뷰어 배경 포함 전체 크림 톤). Vitest + cargo test 러너 동작.
- **S2 아카이브 모듈(TDD)**: `src-tauri/src/archive.rs` — zip/cbz는 `zip` 크레이트, cbr은 `unrar` 크레이트. 이미지 항목만 자연 정렬한 페이지 목록 + 개별 페이지 바이트 추출. 매직 바이트로 종류 판별(확장자 틀린 파일 대응). cargo 테스트 6개 그린(자연정렬·이미지필터·매직바이트·zip추출·rar추출·미지원파일).
- **S3 페이지 서빙**: `open_archive` 커맨드(세션에 페이지 목록 저장) + 커스텀 URI 스킴 `pvpage://localhost/<index>`로 페이지 이미지 스트리밍. `<img src>`로 로드.
- **S4 열기 진입점**: 열기 다이얼로그(cbz/cbr/zip 필터, plugin-dialog) + 창 전체 드래그 앤 드롭(`onDragDropEvent`). 미지원 파일 무시 + 에러 표시. capability에 `dialog:default` 추가.
- **S5 페이지 모드 뷰어(좌→우)**: 화면 맞춤(object-fit contain), ←/→/Space/Home/End/클릭 내비게이션, 현재/전체 페이지 표시, 인접 페이지 프리페치. nav 순수 로직 Vitest 3개 그린.

## 계획과 달라진 점 / 현장 결정
- **rar 픽스처 생성 도구**: cbr 테스트 픽스처를 만들려면 RAR 생성기가 필요해 `brew install --cask rar`(rar 7.23)로 `sample.cbr`를 1회 생성해 커밋. **런타임 rar 의존은 없음**(unrar 크레이트가 읽음). rar cask는 2026-09-01 비활성 예정이나 픽스처는 이미 생성됨. zip/cbz 픽스처는 테스트 시점에 `zip` 크레이트로 생성(커밋 불필요).
- **CBR 페이지 추출 O(N)**: unrar는 스트림 기반이라 N번째 페이지 추출 시 앞에서부터 순회. 일반적 만화(수십 페이지)엔 무해하나 대용량 rar에선 느릴 수 있음 — 필요 시 후속 최적화(열 때 임시 추출/캐시).
- **페이지 서빙 방식**: base64 커맨드 대신 커스텀 프로토콜 채택 — 브라우저 캐싱 + `new Image()` 프리페치가 자연스러움.
- **폰트 미번들**: DESIGN.md의 CursorGothic/Inter를 오프라인 CSP 대비 번들하지 않고 시스템 폰트 스택 폴백 사용. 번들은 후속.
- **정리**: 스캐폴드의 `greet` 커맨드 및 `react.svg`(App 재작성으로 고아) 제거. 초기에 붙였던 tauri `protocol-asset` 기능은 커스텀 스킴엔 불필요해 제거.

## 검증 범위 (중요)
- **기계 검증됨**: cargo test 6 · vitest 3 · `tsc && vite build` · `cargo build` 모두 그린.
- **기계 검증 불가 → 사용자 수동 확인 필요**: 다이얼로그/드래그앤드롭 실제 열기, 페이지 이미지 렌더링, 키보드·클릭 내비게이션 등 GUI 상호작용. (macOS Tauri E2E 미지원 — loop.md에서 합의한 검증 경계) `npm run tauri dev`로 실제 확인 권장.

## 코드 리뷰
- 리스크 영역(인증/DB/공개 API/마이그레이션) 없음, 그린필드 초기 구성이라 별도 적대적 리뷰 페이즈 생략(fg-run 조건부 리뷰 기준의 trivial/low-risk).
