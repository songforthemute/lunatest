import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  createConsumerSmokeScript,
  reactPeerMatrix,
} from "./consumer-smoke-fixtures.mjs";
import {
  collectManifestFileTargets,
  validatePackFiles,
} from "./check-pack-integrity.mjs";
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

test("public package builds force composite emit", async () => {
  for (const { dir: packageDir } of publicPackages) {
    const pkg = await readJson(`${packageDir}/package.json`);

    assert.match(
      pkg.scripts.build,
      /^tsc -b tsconfig\.json --force(?: &&|$)/,
      `${pkg.name} build must force TypeScript project emit instead of trusting stale tsbuildinfo`,
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

test("consumer pack smoke covers all public tarballs and React peer matrix", async () => {
  const script = await readFile(new URL("../scripts/consumer-smoke-pack.mjs", import.meta.url), "utf8");

  assert.match(script, /publicPackages/);
  assert.match(script, /reactPeerMatrix/);
  assert.doesNotMatch(script, /packageNames\(stablePackages\)/);
  assert.deepEqual(reactPeerMatrix, [
    { label: "react18", dependencies: ["react@18.3.1", "react-dom@18.3.1"] },
    { label: "react19", dependencies: ["react@19.2.6", "react-dom@19.2.6"] },
  ]);
});

test("consumer smoke script exercises stable, next, browser, bin, and React entrypoints", () => {
  const script = createConsumerSmokeScript({ includeNextPackages: true });

  assert.match(script, /@lunatest\/core"/);
  assert.match(script, /@lunatest\/core\/browser"/);
  assert.match(script, /@lunatest\/react"/);
  assert.match(script, /@lunatest\/react\/browser"/);
  assert.match(script, /@lunatest\/vitest-plugin"/);
  assert.match(script, /@lunatest\/playwright-plugin"/);
  assert.match(script, /renderToString/);
});

test("pack integrity validates manifest entry targets", () => {
  const manifest = {
    main: "./dist/index.js",
    types: "./dist/index.d.ts",
    exports: {
      ".": {
        types: "./dist/index.d.ts",
        import: "./dist/index.js",
      },
      "./browser": {
        import: "./dist/browser.js",
      },
      "./package.json": "./package.json",
    },
    repository: {
      type: "git",
      url: repositoryUrl,
      directory: "packages/example",
    },
  };

  assert.deepEqual(collectManifestFileTargets(manifest), [
    "dist/browser.js",
    "dist/index.d.ts",
    "dist/index.js",
    "package.json",
  ]);
  assert.deepEqual(
    validatePackFiles("packages/example", ["package.json", "dist/index.js"], manifest),
    [
      "manifest target 누락: dist/browser.js",
      "manifest target 누락: dist/index.d.ts",
    ],
  );
});
