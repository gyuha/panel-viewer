#!/usr/bin/env node
// 공개된 릴리스를 자체 Homebrew tap(gyuha/homebrew-tap)의 Cask에 반영한다. release.sh가 릴리스를 공개한 직후 부르고,
// 실패했을 때는 직접 `node scripts/update-tap.mjs <버전>`으로 다시 실행해도 된다(이미 반영돼 있으면 아무것도 바꾸지 않는다).
//
// 순서: 릴리스가 공개 상태이고 이 저장소의 "최신"인지 확인 → 공개 URL에서 DMG를 내려받아 GitHub가 준 sha256과 대조 →
//       tap 저장소를 새로 받아 Cask를 갱신 → 바뀐 게 있으면 커밋·push.
// 환경 변수: DRY_RUN=1 이면 push만 건너뛴다. SOURCE_REPO(기본 gyuha/panel-viewer), TAP_URL(기본 gyuha/homebrew-tap의 https 주소).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** 버전과 sha256으로 Cask 본문을 만든다. */
export function renderCask(version, sha256) {
  return `cask "panel-viewer" do
  version "${version}"
  sha256 "${sha256}"

  url "https://github.com/gyuha/panel-viewer/releases/download/v#{version}/Panel.Viewer_#{version}_aarch64.dmg"
  name "Panel Viewer"
  desc "만화·웹툰 뷰어"
  homepage "https://github.com/gyuha/panel-viewer"

  depends_on arch: :arm64

  app "Panel Viewer.app"

  # 공식 서명·공증을 거치지 않은 앱이다. 이 앱에 한해서만 격리를 해제한다.
  postflight_steps do
    run "/usr/bin/xattr", args: ["-dr", "com.apple.quarantine", "{{appdir}}/Panel Viewer.app"]
  end
end
`;
}

/** 릴리스 JSON에서 이 버전의 DMG 에셋과 sha256을 고른다. 공개 상태가 아니거나 digest가 없으면 이유와 함께 던진다. */
export function findDmgAsset(release, version) {
  if (release.draft) throw new Error(`v${version}은 아직 공개되지 않은 초안입니다`);
  const name = `Panel.Viewer_${version}_aarch64.dmg`;
  const asset = (release.assets ?? []).find((a) => a.name === name);
  if (!asset) throw new Error(`v${version}에 ${name} 에셋이 없습니다`);
  const m = /^sha256:([0-9a-f]{64})$/.exec(asset.digest ?? "");
  if (!m) throw new Error(`${name}에 GitHub sha256 digest가 없어 검증할 수 없습니다`);
  return { name, url: asset.browser_download_url, sha256: m[1] };
}

const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const gh = (...args) => JSON.parse(execFileSync("gh", ["api", ...args], { encoding: "utf8" }));

/** 공개 직후에는 GitHub가 에셋·digest를 반영하기까지 잠깐 걸릴 수 있어서 몇 번 다시 시도한다. */
async function retry(label, fn, tries = 4, waitMs = 3000) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= tries) throw e;
      console.error(`${label} 실패(${i}/${tries}): ${e.message.split("\n")[0]} — ${waitMs / 1000}초 뒤 다시 시도`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
}

async function main() {
  const version = process.argv[2];
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version ?? "")) throw new Error("사용: node scripts/update-tap.mjs <버전>  (예: 0.2.13)");
  const source = process.env.SOURCE_REPO ?? "gyuha/panel-viewer";
  const tapUrl = process.env.TAP_URL ?? "https://github.com/gyuha/homebrew-tap.git";
  const dry = process.env.DRY_RUN === "1";

  const asset = await retry("릴리스 조회", () => findDmgAsset(gh(`repos/${source}/releases/tags/v${version}`), version));
  // 옛 버전을 나중에 공개하면 tap이 거꾸로 가지 않게, 이 저장소의 최신 릴리스일 때만 갱신한다.
  const latest = gh(`repos/${source}/releases/latest`).tag_name;
  if (latest !== `v${version}`) {
    console.log(`tap 갱신을 건너뜁니다: 이 저장소의 최신 릴리스는 ${latest}입니다 (v${version} 아님)`);
    return;
  }

  const workDir = mkdtempSync(join(tmpdir(), "update-tap-"));
  try {
    // 로그인 없이 받는다 = 정말 공개돼 있는지도 확인한다
    const body = await retry("다운로드", async () => {
      const res = await fetch(asset.url);
      if (!res.ok) throw new Error(`공개 URL에서 내려받지 못했습니다: ${res.status} ${asset.url}`);
      return Buffer.from(await res.arrayBuffer());
    });
    const got = createHash("sha256").update(body).digest("hex");
    if (got !== asset.sha256) throw new Error(`sha256이 다릅니다. GitHub ${asset.sha256} / 내려받은 파일 ${got}. tap을 바꾸지 않았습니다`);

    const tap = join(workDir, "tap");
    execFileSync("git", ["clone", "--quiet", "--depth", "1", tapUrl, tap], { stdio: ["ignore", "pipe", "pipe"] });
    writeFileSync(join(tap, "Casks", "panel-viewer.rb"), renderCask(version, got));
    git(tap, "add", "Casks/panel-viewer.rb");
    if (git(tap, "status", "--porcelain") === "") {
      console.log(`tap이 이미 ${version}입니다. 바꾼 것이 없습니다`);
      return;
    }
    git(tap, "commit", "--quiet", "-m", `Panel Viewer ${version} Homebrew Cask 갱신`);
    if (dry) {
      console.log(`DRY_RUN: push하지 않았습니다 (${tapUrl})\n${git(tap, "show", "--stat", "--format=%s", "HEAD")}`);
      return;
    }
    git(tap, "push", "--quiet");
    console.log(`tap에 ${version}을 push했습니다`);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`update-tap: ${e.message}`);
    process.exit(1);
  });
}
