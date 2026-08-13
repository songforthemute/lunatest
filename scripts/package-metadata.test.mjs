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
  packagesForConsumerChannel,
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
  for (const { dir: packageDir, tag } of publicPackages) {
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
    assert.equal(
      pkg.publishConfig.tag,
      tag,
      `${pkg.name} publishConfig tag must match the shared package roster`,
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
    pkg.scripts["release:publish"],
    "pnpm run release:publish:stable",
  );
  assert.equal(pkg.scripts["release:publish:next"], undefined);
  assert.equal(
    pkg.scripts["release:publish:dry-run"],
    "node scripts/publish-packages.mjs --channel=stable --tag=latest --dry-run",
  );
  assert.deepEqual(packageNames(stablePackages), [
    "@lunatest/contracts",
    "@lunatest/core",
    "@lunatest/runtime-intercept",
    "@lunatest/cli",
    "@lunatest/react",
    "@lunatest/mcp",
    "@lunatest/vitest-plugin",
    "@lunatest/playwright-plugin",
  ]);
  assert.deepEqual(packageNames(nextPackages), []);
});

test("registry consumer smoke verifies packages installed by its selected channel", () => {
  assert.deepEqual(
    packageNames(packagesForConsumerChannel("stable")),
    packageNames(stablePackages),
  );
  assert.deepEqual(
    packageNames(packagesForConsumerChannel("next")),
    packageNames(publicPackages),
  );
});

test("consumer pack smoke covers all public tarballs and React peer matrix", async () => {
  const script = await readFile(new URL("../scripts/consumer-smoke-pack.mjs", import.meta.url), "utf8");

  assert.match(script, /publicPackages/);
  assert.match(script, /reactPeerMatrix/);
  assert.doesNotMatch(script, /packageNames\(stablePackages\)/);
  assert.deepEqual(reactPeerMatrix, [
    {
      label: "react18",
      dependencies: [
        "react@18.3.1",
        "react-dom@18.3.1",
        "@wagmi/core@3.6.4",
        "viem@2.55.11",
      ],
    },
    {
      label: "react19",
      dependencies: [
        "react@19.2.6",
        "react-dom@19.2.6",
        "@wagmi/core@3.6.4",
        "viem@2.55.11",
      ],
    },
  ]);
});

test("consumer smoke script exercises stable runner, browser, bin, and React entrypoints", () => {
  const script = createConsumerSmokeScript({ includeRunnerPackages: true });

  assert.match(script, /@lunatest\/core"/);
  assert.match(script, /@lunatest\/core\/browser"/);
  assert.match(script, /@lunatest\/react"/);
  assert.match(script, /@lunatest\/react\/browser"/);
  assert.match(script, /@lunatest\/react\/wagmi"/);
  assert.match(script, /@wagmi\/core"/);
  assert.match(script, /viem\/chains"/);
  assert.match(script, /@lunatest\/vitest-plugin"/);
  assert.match(script, /@lunatest\/playwright-plugin"/);
  assert.match(script, /renderToString/);
  assert.match(script, /mkdtemp/);
  assert.match(script, /createLunaPageAdapter/);
  assert.match(script, /assertScenario\("scenarios\/quote-ready"/);
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
