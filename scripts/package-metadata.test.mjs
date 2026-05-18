import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  nextPackages,
  packageNames,
  publicPackages,
  repositoryUrl,
  stablePackages,
} from "./package-roster.mjs";

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
  for (const { dir: packageDir } of publicPackages) {
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

test("release scripts publish package channels from the shared roster helper", async () => {
  const pkg = await readJson("package.json");

  assert.equal(
    pkg.scripts["release:publish:stable"],
    "node scripts/publish-packages.mjs --channel=stable --tag=latest",
  );
  assert.equal(
    pkg.scripts["release:publish:next"],
    "node scripts/publish-packages.mjs --channel=next --tag=next",
  );
  assert.equal(
    pkg.scripts["release:publish:dry-run"],
    "node scripts/publish-packages.mjs --channel=stable --tag=latest --dry-run && node scripts/publish-packages.mjs --channel=next --tag=next --dry-run",
  );
  assert.deepEqual(packageNames(stablePackages), [
    "@lunatest/contracts",
    "@lunatest/core",
    "@lunatest/runtime-intercept",
    "@lunatest/cli",
    "@lunatest/react",
    "@lunatest/mcp",
  ]);
  assert.deepEqual(packageNames(nextPackages), [
    "@lunatest/vitest-plugin",
    "@lunatest/playwright-plugin",
  ]);
});
