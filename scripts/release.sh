#!/usr/bin/env bash
#
# GitHub 릴리스 배포 스크립트.
# 버전을 올리고(package.json · tauri.conf.json · Cargo.toml · Cargo.lock) 커밋·태그·푸시,
# .dmg를 빌드해 GitHub 릴리스로 업로드한다.
#
# 사용법:
#   scripts/release.sh              # patch 증가 (기본)
#   scripts/release.sh patch|minor|major
#   scripts/release.sh 1.2.3        # 명시 버전
#
# 요구: gh(로그인) · jq · perl · macOS GUI 세션(.dmg 번들은 Finder가 필요).

set -euo pipefail

cd "$(dirname "$0")/.."  # 저장소 루트로 이동

# ---- 0. 사전 점검 ----
command -v gh  >/dev/null || { echo "❌ gh CLI가 필요합니다."; exit 1; }
command -v jq  >/dev/null || { echo "❌ jq가 필요합니다."; exit 1; }
command -v perl >/dev/null || { echo "❌ perl이 필요합니다."; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "❌ gh 로그인 필요: gh auth login"; exit 1; }

# 커밋되지 않은 변경이 있으면 중단(버전 커밋을 깔끔히 남기기 위해)
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "❌ 커밋되지 않은 변경이 있습니다. 먼저 정리(커밋/스태시)하세요."
  exit 1
fi

# ---- 1. 새 버전 계산 ----
CUR=$(jq -r .version package.json)
ARG="${1:-patch}"
case "$ARG" in
  major|minor|patch)
    IFS=. read -r MA MI PA <<< "$CUR"
    case "$ARG" in
      major) MA=$((MA + 1)); MI=0; PA=0 ;;
      minor) MI=$((MI + 1)); PA=0 ;;
      patch) PA=$((PA + 1)) ;;
    esac
    NEW="$MA.$MI.$PA" ;;
  [0-9]*.[0-9]*.[0-9]*)
    NEW="$ARG" ;;
  *)
    echo "사용법: scripts/release.sh [patch|minor|major|X.Y.Z]"
    exit 1 ;;
esac
TAG="v$NEW"
echo "▶ 버전: $CUR → $NEW  (태그 $TAG)"

# 태그/릴리스 중복 방지
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "❌ 태그 $TAG 가 이미 있습니다."; exit 1
fi
if gh release view "$TAG" >/dev/null 2>&1; then
  echo "❌ 릴리스 $TAG 가 이미 있습니다."; exit 1
fi

# ---- 2. 버전 4곳 갱신 ----
tmp=$(mktemp); jq --arg v "$NEW" '.version=$v' package.json > "$tmp" && mv "$tmp" package.json
tmp=$(mktemp); jq --arg v "$NEW" '.version=$v' src-tauri/tauri.conf.json > "$tmp" && mv "$tmp" src-tauri/tauri.conf.json
# Cargo.toml: [package]의 첫 version 줄만 교체
NEW="$NEW" perl -i -pe 'if (!$d && s/^version = "[^"]*"/version = "$ENV{NEW}"/) { $d = 1 }' src-tauri/Cargo.toml
# Cargo.lock: panel-viewer 패키지 항목의 version 교체(있을 때만)
if [ -f src-tauri/Cargo.lock ]; then
  NEW="$NEW" perl -0777 -i -pe 's/(name = "panel-viewer"\nversion = ")[^"]*/${1}$ENV{NEW}/' src-tauri/Cargo.lock
fi
echo "✔ 버전 파일 갱신 완료"

# ---- 3. 커밋 · 태그 · 푸시 ----
git add -A
# 자동 커밋 훅이 이미 커밋했을 수도 있으므로 실패를 허용(태그는 어차피 HEAD를 가리킴)
git commit -m "chore: release $TAG" || echo "  (버전 변경이 이미 커밋됨 — 계속)"
git tag "$TAG"
git push origin HEAD
git push origin "$TAG"
echo "✔ 커밋·태그·푸시 완료"

# ---- 4. 빌드(.dmg) ----
echo "▶ 빌드 중 (npm run tauri build) — DMG 번들은 macOS GUI 세션이 필요합니다…"
npm run tauri build

DMG=$(ls -t src-tauri/target/release/bundle/dmg/*.dmg 2>/dev/null | head -1 || true)
if [ -z "$DMG" ] || [ ! -f "$DMG" ]; then
  echo "❌ .dmg를 찾지 못했습니다. (DMG 번들 단계 실패 — GUI 세션에서 실행했는지 확인)"
  echo "   태그 $TAG 는 푸시됐으니, 문제 해결 후 다음처럼 수동 업로드할 수 있습니다:"
  echo "   gh release create $TAG <경로>/파일.dmg --title $TAG --generate-notes"
  exit 1
fi
echo "✔ 빌드 산출물: $DMG"

# ---- 5. GitHub 릴리스 생성 + 업로드 ----
gh release create "$TAG" "$DMG" --title "$TAG" --generate-notes
echo "✅ 릴리스 완료: $TAG"
gh release view "$TAG" --web >/dev/null 2>&1 || true
