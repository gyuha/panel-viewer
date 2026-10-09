# RUN — 릴리스 배포 후 Homebrew tap Cask 자동 갱신

워크플로우 없이 직접 TDD로 실행(소규모 작업).

## 슬라이스 결과
- S1 update-tap.test.mjs(골든 Cask 비교 + 에셋/digest 로직) — ✅ as planned (구현 전 ERR_MODULE_NOT_FOUND로 red 확인)
- S2 update-tap.mjs 구현 — ✅ as planned (twin-deck의 2개 스크립트를 1개로 합침, ZIP 검증 제거, DMG 기준)
- S3 release.sh 호출 추가 — ⚠ 계획에 없던 `command -v node` 사전 점검 1줄과 헤더 주석 1줄 추가(스크립트가 node를 새로 요구하므로)

## DoD baseline → after
1. node --test: 파일 없음 → 4 pass / 0 fail
2. DRY_RUN=1 node scripts/update-tap.mjs 0.2.12: 파일 없음 → exit 0, "tap이 이미 0.2.12입니다"
3. release.sh: update-tap 호출 0 → 있음(95행 gh release create 뒤 100행), exit 4 분기, bash -n 통과
4. 회귀 가드(이미 통과 상태): npm test 73 pass · cargo test 29 pass, 변경은 scripts/ 안
5. 실제 release/push 미실행

## 메모
- 골든 픽스처 `scripts/fixtures/panel-viewer.rb`는 tap의 현재 파일 사본.
- 한계: tap push 경로(실제 변경 시 commit·push)는 다음 실제 `task release`에서 처음 실행됨.
