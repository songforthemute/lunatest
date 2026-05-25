import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("VitePress config uses the docs command root as the source root", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const config = await readFile(new URL("../docs/.vitepress/config.mts", import.meta.url), "utf8");

  assert.equal(pkg.scripts["docs:build"], "vitepress build docs");
  assert.doesNotMatch(config, /srcDir:\s*["']docs["']/);
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
});
