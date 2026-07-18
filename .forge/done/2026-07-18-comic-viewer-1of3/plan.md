<!-- forge-slug: comic-viewer-1of3 -->
<!-- task: 1 -->
<!-- part: 1/3 -->
<!-- tdd: on -->
# 코어 뷰어 — 스캐폴딩 + 아카이브 백엔드 + 페이지 모드

## Goal / Non-goals
- Goal: Tauri 2 + React + TS + Vite 앱에서 코믹 아카이브(cbz/zip/cbr)를 열어 좌→우 페이지 모드로 끝까지 읽을 수 있는 최소 뷰어를 만든다. 열기는 다이얼로그와 드래그 앤 드롭 두 경로.
- Non-goals:
  - 우→좌 모드, 연속 스크롤 모드, 상태 기억 (part 2/3)
  - 파일 패널, 커버 썸네일, OS 파일 연결 (part 3/3)
  - 두 쪽 스프레드 표시 — 페이지 모드는 항상 한 장씩
  - 자유 줌(확대 후 패닝) — 핏 모드만
  - Windows/Linux 빌드 검증 — macOS 우선 (Tauri 설정은 크로스플랫폼으로 작성)

## Source of truth
- Glossary terms: 코믹 아카이브, 페이지, 보기 모드 — `.forge/CONTEXT.md`
- Related ADRs: `.forge/adr/260718-15a-cbr-unrar-crate.md` (CBR은 unrar 크레이트)
- 디자인: `DESIGN.md`의 토큰(크림 캔버스 `#f7f7f4`, 잉크 `#26251e`, Cursor Orange `#f54e00`, 헤어라인 깊이, 그림자 없음)을 CSS 변수로 정의해 앱 전체에 적용. **뷰어 배경도 크림 톤으로 통일**(다크 배경 아님 — 그릴링에서 확정).
- Definition of Done: 샘플 cbz/cbr/zip 각각을 다이얼로그와 드래그 앤 드롭으로 열어, 화면 맞춤으로 렌더링된 페이지를 키보드(←/→/Space)와 클릭으로 처음부터 끝까지 넘길 수 있다.

## Work slices
- [ ] S1. 프로젝트 스캐폴딩 — Tauri 2 + React + TS + Vite 생성, DESIGN.md 토큰을 CSS 변수로 세팅한 빈 앱 셸 — 완료 기준: `npm run tauri dev`로 크림 캔버스의 빈 셸이 뜨고, `cargo test`/`npm test`(Vitest) 러너가 동작한다
- [ ] S2. Rust 아카이브 모듈(TDD) — zip/cbz는 zip 크레이트, cbr은 unrar 크레이트로 열고, 이미지 항목(jpg/png/gif/webp/avif)만 자연 정렬한 페이지 목록과 개별 페이지 바이트 추출을 제공 — 완료 기준: 픽스처 아카이브(cbz/cbr/zip, 비이미지 항목·중첩 폴더 포함)로 페이지 목록 순서와 추출 바이트를 검증하는 `cargo test`가 통과한다
- [ ] S3. 페이지 서빙 — 아카이브 열기/페이지 목록/페이지 이미지 로드를 Tauri 커맨드(또는 custom protocol)로 프론트에 노출 — 완료 기준: 프론트에서 지정 인덱스의 페이지 이미지가 `<img>`로 로드된다 (depends: S2)
- [ ] S4. 파일 열기 진입점 — 열기 다이얼로그(cbz/cbr/zip 필터) + 창 전체 드래그 앤 드롭 — 완료 기준: 두 경로 모두로 아카이브가 열리고, 지원하지 않는 파일은 무시되며 에러 안내가 표시된다 (depends: S3)
- [ ] S5. 페이지 모드 뷰어(좌→우) — 화면 맞춤(fit-to-window) 렌더링, ←/→/Space/클릭 내비게이션, 현재/전체 페이지 표시, 인접 페이지 프리페치 — 완료 기준: 샘플 cbz를 키보드만으로 처음부터 끝까지 읽을 수 있고 페이지 전환이 체감 지연 없이 된다 (depends: S3)
