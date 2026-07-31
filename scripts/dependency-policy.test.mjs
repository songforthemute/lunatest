import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { win32 } from "node:path";

import {
  createTarballOverrides,
  formatWorkspaceOverrides,
} from "./pnpm-workspace-overrides.mjs";

const requiredOverrides = new Map([
  ["picomatch@<2.3.2", "2.3.2"],
  ["picomatch@>=4.0.0 <4.0.4", "4.0.4"],
  ["smol-toml@<1.6.1", "1.6.1"],
  ["postcss@>=8.0.0 <8.5.18", "8.5.18"],
  ["ws@>=8.0.0 <8.21.0", "8.21.0"],
  ["@babel/core@>=7.0.0 <=7.29.0", "7.29.6"],
  ["js-yaml@>=3.0.0 <3.15.0", "3.15.0"],
  ["js-yaml@>=4.0.0 <4.3.0", "4.3.0"],
  ["vite@>=5.0.0 <=6.4.2", "6.4.3"],
  ["vite@>=7.0.0 <=7.3.1", "7.3.3"],
]);

const expectedMinimumReleaseAgeMinutes = 10_080;
const vulnerableVitestBrowserAdvisoryRange =
  /@vitest\/browser-[^@:'"\n]+(?:['"]?:\s*4\.1\.[0-5]\b|@4\.1\.[0-5]\b)/;

async function readRootFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

async function readRootJson(path) {
  return JSON.parse(await readRootFile(path));
}

function assertWorkspaceOverride(workspace, selector, version) {
  assert.match(
    workspace,
    new RegExp(`^  "${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}": "${version}"$`, "m"),
    `pnpm-workspace.yaml must override ${selector} to ${version}`,
  );
}

test("pnpm overrides live in pnpm-workspace.yaml", async () => {
  const rootPackage = await readRootJson("package.json");
  const workspace = await readRootFile("pnpm-workspace.yaml");

  assert.equal(
    rootPackage.pnpm,
    undefined,
    "package.json pnpm.overrides is ignored by current pnpm; use pnpm-workspace.yaml instead",
  );

  for (const [selector, version] of requiredOverrides) {
    assertWorkspaceOverride(workspace, selector, version);
  }
});

test("pnpm install-time supply-chain policy is explicit", async () => {
  const workspace = await readRootFile("pnpm-workspace.yaml");

  assert.match(
    workspace,
    new RegExp(`^minimumReleaseAge: ${expectedMinimumReleaseAgeMinutes}$`, "m"),
    "pnpm-workspace.yaml must wait 7 days before accepting newly published versions",
  );
  assert.match(
    workspace,
    /^blockExoticSubdeps: true$/m,
    "pnpm-workspace.yaml must block transitive exotic dependency specs",
  );
  assert.doesNotMatch(
    workspace,
    /^minimumReleaseAgeExclude:\s*\n(?:  - .+\n?)+/m,
    "minimumReleaseAge exclusions must be reviewed before being added",
  );
});

test("consumer pack smoke writes local tarball overrides to pnpm-workspace.yaml", async () => {
  const smokeScript = await readRootFile("scripts/consumer-smoke-pack.mjs");

  assert.match(smokeScript, /pnpm-workspace\.yaml/);
  assert.match(smokeScript, /createTarballOverrides\(tarballs, matrixConsumerDir\)/);
  assert.match(smokeScript, /minimumReleaseAge/);
  assert.match(smokeScript, /blockExoticSubdeps/);
  assert.doesNotMatch(smokeScript, /pnpm:\s*{\s*overrides/s);
  assert.doesNotMatch(smokeScript, /file:\$\{pkg\.tarball\}/);
});

test("consumer pack smoke writes platform-safe workspace-relative tarball overrides", () => {
  const posixOverrides = createTarballOverrides(
    [{ name: "@lunatest/core", tarball: "/tmp/lunatest-consumer-pack/tarballs/lunatest-core-0.1.3.tgz" }],
    "/tmp/lunatest-consumer-pack/consumer/react18",
  );
  const consumerDir = "C:\\Users\\RUNNER~1\\AppData\\Local\\Temp\\lunatest-consumer-pack\\consumer\\react18";
  const overrides = createTarballOverrides(
    [
      {
        name: "@lunatest/core",
        tarball: "C:\\Users\\RUNNER~1\\AppData\\Local\\Temp\\lunatest-consumer-pack\\tarballs\\lunatest-core-0.1.3.tgz",
      },
    ],
    consumerDir,
    win32.relative,
  );

  assert.equal(posixOverrides["@lunatest/core"], "file:../../tarballs/lunatest-core-0.1.3.tgz");
  assert.equal(overrides["@lunatest/core"], "file:../../tarballs/lunatest-core-0.1.3.tgz");
  assert.doesNotMatch(overrides["@lunatest/core"], /%7E/i);
  assert.equal(
    formatWorkspaceOverrides(overrides),
    '  "@lunatest/core": "file:../../tarballs/lunatest-core-0.1.3.tgz"',
  );
  assert.throws(
    () => createTarballOverrides(
      [{ name: "@lunatest/core", tarball: "D:\\tarballs\\lunatest-core-0.1.3.tgz" }],
      consumerDir,
      win32.relative,
      win32.isAbsolute,
    ),
    /must be relative to the consumer workspace/,
  );
});

test("example apps use the patched Vite 6 line directly", async () => {
  const swapExamplePackage = await readRootJson("examples/swap-dapp/package.json");
  const defiDashboardPackage = await readRootJson("examples/defi-dashboard/package.json");

  assert.equal(swapExamplePackage.devDependencies.vite, "6.4.3");
  assert.equal(defiDashboardPackage.devDependencies.vite, "6.4.3");
});

test("DeFi dashboard clean-checkout scripts prebuild workspace dependencies", async () => {
  const pkg = await readRootJson("examples/defi-dashboard/package.json");

  assert.equal(
    pkg.scripts["build:deps"],
    "pnpm --filter @lunatest/contracts --filter @lunatest/core --filter @lunatest/runtime-intercept build",
  );
  assert.equal(pkg.scripts.predev, "pnpm run build:deps");
  assert.equal(pkg.scripts.pretest, "pnpm run build:deps");
  assert.equal(pkg.scripts.prebuild, "pnpm run build:deps");
});

test("workspace test runners use the patched Vitest 4 line directly", async () => {
  const rootPackage = await readRootJson("package.json");
  const e2ePackage = await readRootJson("e2e-tests/package.json");
  const swapExamplePackage = await readRootJson("examples/swap-dapp/package.json");
  const defiDashboardPackage = await readRootJson("examples/defi-dashboard/package.json");

  assert.equal(rootPackage.devDependencies.vitest, "4.1.6");
  assert.equal(e2ePackage.devDependencies.vitest, "4.1.6");
  assert.equal(swapExamplePackage.devDependencies.vitest, "4.1.6");
  assert.equal(defiDashboardPackage.devDependencies.vitest, "4.1.6");
});

test("Chromium scenario tests pin a release that satisfies the registry age policy", async () => {
  const e2ePackage = await readRootJson("e2e-tests/package.json");
  const lockfile = await readRootFile("pnpm-lock.yaml");

  assert.equal(e2ePackage.devDependencies["@playwright/test"], "1.61.1");
  assert.match(lockfile, /'@playwright\/test@1\.61\.1':/);
  assert.match(lockfile, /playwright@1\.61\.1:/);
});

test("Vitest browser advisory guard matches peer and package lockfile forms", () => {
  const vulnerableLockfileForms = [
    "      '@vitest/browser-playwright': 4.1.5",
    "  '@vitest/browser-playwright@4.1.5':",
    "  '@vitest/browser-preview@4.1.0':",
    "  '@vitest/browser-webdriverio@4.1.5(vitest@4.1.5)':",
  ];
  const patchedLockfileForms = [
    "      '@vitest/browser-playwright': 4.1.6",
    "  '@vitest/browser-playwright@4.1.6':",
    "  '@vitest/browser-preview@4.2.0':",
    "  '@vitest/browser-webdriverio@4.1.6(vitest@4.1.6)':",
  ];

  for (const lockfileLine of vulnerableLockfileForms) {
    assert.match(lockfileLine, vulnerableVitestBrowserAdvisoryRange);
  }
  for (const lockfileLine of patchedLockfileForms) {
    assert.doesNotMatch(lockfileLine, vulnerableVitestBrowserAdvisoryRange);
  }
});

test("lockfile excludes Vite, PostCSS, ws, Babel, js-yaml, esbuild, and Vitest advisory ranges", async () => {
  const lockfile = await readRootFile("pnpm-lock.yaml");

  assert.doesNotMatch(lockfile, /vite@5\.4\.21/);
  assert.doesNotMatch(lockfile, /vite@7\.3\.1/);
  assert.doesNotMatch(lockfile, /vite@6\.4\.2/);
  assert.doesNotMatch(lockfile, /postcss@8\.5\.(?:[0-9]|1[0-7])\b/);
  assert.doesNotMatch(lockfile, /ws@8\.20\.1/);
  assert.doesNotMatch(lockfile, /'@babel\/core@7\.29\.0'/);
  assert.doesNotMatch(lockfile, /js-yaml@3\.14\.2/);
  assert.doesNotMatch(lockfile, /js-yaml@4\.1\.1/);
  assert.doesNotMatch(lockfile, /esbuild@0\.21\.5/);
  assert.doesNotMatch(lockfile, /vitest@3\.2\.4/);
  assert.doesNotMatch(lockfile, /vitest@4\.1\.[0-5]\b/);
  assert.doesNotMatch(lockfile, vulnerableVitestBrowserAdvisoryRange);
  assert.match(lockfile, /vite@6\.4\.3/);
  assert.match(lockfile, /postcss@8\.5\.18/);
  assert.match(lockfile, /ws@8\.21\.0/);
  assert.match(lockfile, /'@babel\/core@7\.29\.6'/);
  assert.match(lockfile, /js-yaml@3\.15\.0/);
  assert.match(lockfile, /js-yaml@4\.3\.0/);
  assert.match(lockfile, /esbuild@0\.25\./);
  assert.match(lockfile, /vitest@4\.1\.6/);
});
