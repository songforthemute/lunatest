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

test("docs build rejects historical planning artifacts from the public site", async () => {
  const buildScript = await readFile(new URL("./build-docs-site.mjs", import.meta.url), "utf8");

  assert.match(buildScript, /PRD\.html/);
  assert.match(buildScript, /path\.join\(DOCS_DIST, "plans"\)/);
  assert.match(buildScript, /Historical planning artifact/);
});

test("docs navigation exposes the DeFi dashboard dogfood guide", async () => {
  const config = await readFile(new URL("../docs/.vitepress/config.mts", import.meta.url), "utf8");
  const index = await readFile(new URL("../docs/index.md", import.meta.url), "utf8");
  const koIndex = await readFile(new URL("../docs/ko/index.md", import.meta.url), "utf8");
  const guide = await readFile(new URL("../docs/guides/defi-dashboard-dogfood.md", import.meta.url), "utf8");
  const koGuide = await readFile(new URL("../docs/ko/guides/defi-dashboard-dogfood.md", import.meta.url), "utf8");

  assert.match(config, /\/guides\/defi-dashboard-dogfood/);
  assert.match(config, /\/ko\/guides\/defi-dashboard-dogfood/);
  assert.match(index, /guides\/defi-dashboard-dogfood\.md/);
  assert.match(koIndex, /guides\/defi-dashboard-dogfood\.md/);
  assert.match(guide, /@lunatest\/example-defi-dashboard/);
  assert.match(koGuide, /@lunatest\/example-defi-dashboard/);
});

test("MCP stdio documentation describes the project-aware executable in both languages", async () => {
  const config = await readFile(new URL("../docs/.vitepress/config.mts", import.meta.url), "utf8");
  const readDoc = async (path) => readFile(new URL(path, import.meta.url), "utf8").catch(() => "");
  const [guide, koGuide, libraryGuide, koLibraryGuide, api, koApi] = await Promise.all([
    readDoc("../docs/guides/mcp-stdio.md"),
    readDoc("../docs/ko/guides/mcp-stdio.md"),
    readDoc("../docs/guides/library-consumption.md"),
    readDoc("../docs/ko/guides/library-consumption.md"),
    readDoc("../docs/api/mcp.md"),
    readDoc("../docs/ko/api/mcp.md"),
  ]);

  assert.match(config, /\{ text: "MCP stdio", link: "\/guides\/mcp-stdio" \}/);
  assert.match(config, /\{ text: "MCP stdio", link: "\/ko\/guides\/mcp-stdio" \}/);

  for (const doc of [guide, koGuide]) {
    assert.match(doc, /pnpm exec lunatest-mcp/);
    assert.match(doc, /--config <path>/);
    assert.match(doc, /--empty/);
    assert.match(doc, /lunatest\.lua/);
    assert.match(doc, /scenarios\/swap\.lua/);
    assert.match(doc, /scenario\.list/);
    assert.match(doc, /scenario\.run/);
    assert.match(doc, /coverage\.report/);
    assert.match(doc, /coverage\.gaps/);
    assert.match(doc, /coverage\.suggest/);
    assert.match(doc, /process-memory|프로세스 메모리/);
    assert.doesNotMatch(doc, /packages\/mcp\/dist/);
  }

  for (const doc of [libraryGuide, koLibraryGuide, api, koApi]) {
    assert.match(doc, /mcp-stdio/);
  }

  assert.match(guide, /prompt\.get` renders only caller-provided `params\.input`/);
  assert.match(koGuide, /prompt\.get`은 호출자가 전달한 `params\.input`만 렌더링/);
  assert.match(api, /prompt\.get` renders only caller-provided `params\.input`/);
  assert.match(koApi, /prompt\.get`은 호출자가 전달한 `params\.input`만 렌더링/);

  for (const doc of [guide, api]) {
    assert.doesNotMatch(doc, /active project coverage\/component context/);
  }

  for (const doc of [koGuide, koApi]) {
    assert.doesNotMatch(doc, /현재 프로젝트의 coverage\/component 컨텍스트/);
  }
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
  assert.match(
    workflow,
    /node --test scripts\/docs-contracts\.test\.mjs scripts\/docs-site\.test\.mjs/,
  );
  assert.match(workflow, /"scripts\/docs-contracts\.test\.mjs"/);
  assert.match(workflow, /"scripts\/docs-site\.test\.mjs"/);
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
