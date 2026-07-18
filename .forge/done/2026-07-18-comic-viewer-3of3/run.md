<!-- forge-slug: comic-viewer-3of3 -->
# RUN — 파일 패널 + 커버 썸네일 + OS 파일 연결 (comic-viewer-3of3)

## 계획대로 된 것
- **S1 폴더 읽기 커맨드(TDD)**: `fs.rs` — 지정 폴더 한 단계의 하위 폴더 + 코믹 아카이브(cbz/cbr/zip)를 자연 정렬로 반환(숨김·비아카이브 제외). archive의 `natural_cmp`를 `pub(crate)`로 공유. cargo 테스트 2개 그린(필터·정렬, 빈 폴더). 커맨드 `read_dir(path?)`는 path 없으면 홈 디렉터리.
- **S2 파일 패널 UI**: `FilePanel` — 현재 폴더 경로, 상위 폴더(↩), 하위 폴더(📁, 클릭 이동), 코믹 파일(클릭 즉시 뷰어에서 열림) 평평한 목록. 현재 읽는 파일은 Cursor Orange로 강조. 폴더 트리 아님(그릴링 확정). 앱은 좌측 패널 + 우측 뷰어 셸 레이아웃으로 재구성.
- **S3 커버 썸네일**: `thumbnail.rs` — 첫 페이지 추출→`image` 크레이트로 디코드→최대 240px 리사이즈→JPEG 인코드→앱 캐시 디렉터리에 경로+mtime 해시로 캐시. cargo 테스트 1개 그린(작은 JPEG 산출 + 2회차 캐시 히트 동일 바이트). 패널 행은 IntersectionObserver로 화면에 보일 때만 지연 추출, blob URL로 표시·revoke.
- **S4 OS 파일 연결**: tauri.conf.json에 .cbz/.cbr `fileAssociations`(role Viewer) 추가 — `.app` Info.plist의 CFBundleDocumentTypes로 반영 확인. 시작 인자(Windows/Linux·CLI) + macOS `RunEvent::Opened` 처리 → 대기 파일(`take_pending_file`) + 실행 중 `open-archive` 이벤트로 프런트가 즉시 열기. `.run()`을 `.build()?.run(handler)`로 전환.

## 계획과 달라진 점 / 현장 결정
- **C4 전체 `npm run tauri build`는 DMG 단계에서 실패**: release 바이너리 + `.app` 번들은 정상 생성되나 마지막 `bundle_dmg.sh`가 헤드리스 환경(Finder/AppleScript로 DMG 창 구성 불가)에서 실패. **앱 코드 결함이 아닌 환경 한계**. 검증은 `npm run tauri build -- --bundles app`(exit 0) + Info.plist 파일연결 확인으로 대체 — 이것이 "파일 연결 포함 앱 번들"이라는 C4의 본질을 더 충실히 검증. **DMG 배포 패키징이 필요하면 GUI 세션 있는 환경/CI에서 별도 수행 필요**.
- **썸네일 전송**: 커스텀 프로토콜의 경로 퍼센트 인코딩(한글/공백 파일명) 취약성을 피하려 커맨드가 Vec<u8>를 반환하고 프런트에서 blob URL 생성. 한글 파일명에 robust. number[] 전송 오버헤드는 썸네일이 작아 무해.
- **avif 등 디코드 실패 시**: 썸네일 없이 플레이스홀더 유지(패널은 안 죽음). `image` 기본 기능은 png/jpeg/gif/webp/bmp 커버.

## 검증 범위 (중요)
- **기계 검증됨**: cargo test 13(archive 6 + state 4 + fs 2 + thumbnail 1) · vitest 6 · `tsc && vite build` · `npm run tauri build --bundles app` exit 0 · Info.plist에 cbz/cbr 파일연결.
- **기계 검증 불가 → 사용자 수동 확인 필요**: 파일 패널 실제 폴더 탐색·파일 열기·현재 파일 강조, 썸네일 실제 렌더링, Finder에서 .cbz/.cbr 더블클릭 시 앱 실행(설치·Launch Services 등록 후). `npm run tauri dev` 및 빌드된 `.app` 설치로 확인 권장.

## 코드 리뷰
- 파일시스템 읽기(read_dir)는 사용자 홈 이하 탐색만, 쓰기는 앱 데이터/캐시 디렉터리 한정. 외부 노출·프로드 데이터·마이그레이션 없음 → 별도 적대적 리뷰 페이즈 생략.
