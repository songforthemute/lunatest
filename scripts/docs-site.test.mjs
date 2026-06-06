import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("docs build script keeps VitePress root and builds the live demo sub-app", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const config = await readFile(new URL("../docs/.vitepress/config.mts", import.meta.url), "utf8");
  const buildScript = await readFile(new URL("./build-docs-site.mjs", import.meta.url), "utf8");

  assert.equal(pkg.scripts["docs:build"], "node scripts/build-docs-site.mjs");
  assert.doesNotMatch(config, /srcDir:\s*["']docs["']/);
  assert.match(buildScript, /vitepress/);
  assert.match(buildScript, /build:workspace:ci/);
  assert.match(buildScript, /examples\/swap-dapp/);
  assert.match(buildScript, /VITE_LUNATEST_DEMO_MODE/);
  assert.match(buildScript, /deterministic/);
  assert.match(buildScript, /examples\/swap-dapp\/index\.html/);
  assert.match(buildScript, /lunatest\.lua/);
  assert.match(buildScript, /copyFileSync|copyFile/);
});

test("docs do not link to repository files through VitePress-relative examples paths", async () => {
  const docs = [
    "../docs/guides/local-preset-authoring.md",
    "../docs/ko/guides/local-preset-authoring.md",
  ];

  for (const docPath of docs) {
    const doc = await readFile(new URL(docPath, import.meta.url), "utf8");

    assert.doesNotMatch(doc, /\]\(\.\.\/\.\.\/examples\//, docPath);
  }
});

test("Docs workflow verifies the Pages artifact has an index page", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/docs.yml", import.meta.url),
    "utf8",
  );

  assert.match(workflow, /Verify docs Pages artifact/);
  assert.match(workflow, /test -f docs\/\.vitepress\/dist\/index\.html/);
  assert.match(workflow, /test -f docs\/\.vitepress\/dist\/examples\/swap-dapp\/index\.html/);
  assert.match(workflow, /test -f docs\/\.vitepress\/dist\/examples\/swap-dapp\/lunatest\.lua/);
  assert.match(workflow, /"examples\/swap-dapp\/\*\*"/);
  assert.match(workflow, /"scripts\/build-docs-site\.mjs"/);
});

test("Docs workflow runs a post-deploy live demo smoke check", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/docs.yml", import.meta.url),
    "utf8",
  );
  const smokeScript = await readFile(
    new URL("./check-docs-live-demo.mjs", import.meta.url),
    "utf8",
  );

  assert.match(workflow, /Smoke deployed live demo/);
  assert.match(workflow, /DOCS_SITE_URL:\s*\$\{\{\s*steps\.deployment\.outputs\.page_url\s*\}\}/);
  assert.match(workflow, /node scripts\/check-docs-live-demo\.mjs/);
  assert.match(smokeScript, /guides\/live-demo/);
  assert.match(smokeScript, /examples\/swap-dapp\//);
  assert.match(smokeScript, /examples\/swap-dapp\/lunatest\.lua/);
  assert.match(smokeScript, /swap_demo_runtime/);
});
