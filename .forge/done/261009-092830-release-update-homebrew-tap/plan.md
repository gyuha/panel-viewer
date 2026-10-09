<!-- forge-slug: release-update-homebrew-tap -->
<!-- task: 22 -->
<!-- tdd: on -->
# 릴리스 배포 후 Homebrew tap Cask 자동 갱신

## 목표 / 비목표
- 목표: `task release`가 GitHub 릴리스를 공개한 직후 `gyuha/homebrew-tap`의 `Casks/panel-viewer.rb`를 새 버전·sha256으로 갱신해 push한다. 참고: gyuha/twin-deck의 `scripts/update-tap.mjs` + `update-homebrew-cask.mjs` (ZIP 대신 이 프로젝트의 DMG 에셋 `Panel.Viewer_<ver>_aarch64.dmg` 기준, 두 스크립트를 하나로 합친다).
- 비목표: 실제 릴리스 실행, tap에 실제 push(검증은 `DRY_RUN=1`만), release.sh의 다른 동작 변경, Windows/ZIP 지원, 스크립트 2분할, CLAUDE.md 개편.

## 근거 자료
- 용어: 없음
- 관련 ADR: 없음
- 완료 정의(DoD):
  1. `node --test scripts/update-tap.test.mjs` 통과 — Cask 생성 함수(버전 0.2.12, sha256 `1b72f1f8c2ce8071b6fc8d78d21aab302f91053559de72bd9a3e3f10027908b0`)의 출력이 현재 tap의 `Casks/panel-viewer.rb`와 바이트 단위로 동일(골든). 사전 상태: 파일 없음 → 실패(red), 구현 후 green.
  2. `DRY_RUN=1 node scripts/update-tap.mjs 0.2.12` 종료 코드 0이고 "이미 최신(unchanged)" 출력. 실제 공개 릴리스·실제 tap을 읽는 end-to-end(push 없음). 사전 상태: 파일 없음 → 실패.
  3. `bash -n scripts/release.sh` 통과, `update-tap.mjs` 호출 줄이 `gh release create` 줄보다 뒤에 있고, 실패 시 종료 코드 4로 끝나는 분기가 있음(릴리스는 되돌리지 않음). 실제 릴리스를 돌릴 수 없어 정적 검증이며, push 단계는 다음 실제 `task release`에서 처음 실행됨.
  4. 회귀 방지: `npm test`와 `cargo test`가 계속 통과, `git diff --stat`가 `scripts/` 밖(+`.forge/`)을 바꾸지 않음. (이미 통과 상태인 회귀 가드 — 이 작업이 기존 스위트를 건드리지 않음을 보장)
  5. 안전: 작업 중 실제 `gh release create`·tap `git push`를 실행하지 않음.

## 작업 슬라이스
- [ ] S1. `scripts/update-tap.test.mjs` 작성(골든 Cask 비교 + 에셋/digest 선택 로직) — 완료 기준: 구현 전 `node --test`가 실패(red)
- [ ] S2. `scripts/update-tap.mjs` 구현(릴리스 에셋·digest 조회 → 공개 URL 다운로드·sha256 대조 → tap clone → Cask 재생성 → 변경 시 commit·push, `DRY_RUN=1`이면 push 생략, "최신 릴리스일 때만 갱신" 가드 포함) — 완료 기준: DoD 1·2 green (depends: S1)
- [ ] S3. `scripts/release.sh` 끝에 `node scripts/update-tap.mjs "$NEW"` 호출 추가(실패해도 릴리스는 유지, 안내 출력 후 종료 코드 4) — 완료 기준: DoD 3 충족 (depends: S2)
