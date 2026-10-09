import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderCask, findDmgAsset } from "./update-tap.mjs";

const SHA = "1b72f1f8c2ce8071b6fc8d78d21aab302f91053559de72bd9a3e3f10027908b0";

test("renderCask는 현재 tap의 panel-viewer.rb와 바이트 단위로 같다", () => {
  const golden = readFileSync(new URL("./fixtures/panel-viewer.rb", import.meta.url), "utf8");
  assert.equal(renderCask("0.2.12", SHA), golden);
});

test("renderCask는 버전과 sha256만 바꾼다", () => {
  const out = renderCask("0.3.0", "a".repeat(64));
  assert.match(out, /version "0\.3\.0"/);
  assert.match(out, /sha256 "a{64}"/);
});

test("findDmgAsset은 이 버전의 DMG와 digest를 고른다", () => {
  const release = { draft: false, assets: [{ name: "Panel.Viewer_0.2.12_aarch64.dmg", digest: `sha256:${SHA}`, browser_download_url: "u" }] };
  assert.deepEqual(findDmgAsset(release, "0.2.12"), { name: "Panel.Viewer_0.2.12_aarch64.dmg", url: "u", sha256: SHA });
});

test("findDmgAsset은 초안·digest 없음을 거부한다", () => {
  assert.throws(() => findDmgAsset({ draft: true, assets: [] }, "0.2.12"), /초안/);
  assert.throws(() => findDmgAsset({ draft: false, assets: [{ name: "Panel.Viewer_0.2.12_aarch64.dmg" }] }, "0.2.12"), /digest/);
});
