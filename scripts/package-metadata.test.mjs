import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const repositoryUrl = "https://github.com/songforthemute/lunatest";
const publicPackageDirs = [
  "packages/contracts",
  "packages/core",
  "packages/runtime-intercept",
  "packages/cli",
  "packages/react",
  "packages/mcp",
  "packages/vitest-plugin",
  "packages/playwright-plugin",
];

async function readJson(path) {
  return JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
}

test("root package declares the GitHub repository used by trusted publishing", async () => {
  const pkg = await readJson("package.json");

  assert.deepEqual(pkg.repository, {
    type: "git",
    url: repositoryUrl,
  });
});

test("public packages declare repository metadata matching npm provenance", async () => {
  for (const packageDir of publicPackageDirs) {
    const pkg = await readJson(`${packageDir}/package.json`);

    assert.deepEqual(
      pkg.repository,
      {
        type: "git",
        url: repositoryUrl,
        directory: packageDir,
      },
      `${pkg.name} repository metadata must match the GitHub Actions provenance source`,
    );
  }
});
