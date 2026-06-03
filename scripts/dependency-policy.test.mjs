import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const requiredOverrides = new Map([
  ["picomatch@<2.3.2", "2.3.2"],
  ["picomatch@>=4.0.0 <4.0.4", "4.0.4"],
  ["smol-toml@<1.6.1", "1.6.1"],
  ["postcss@<8.5.10", "8.5.10"],
  ["ws@>=8.0.0 <8.20.1", "8.20.1"],
  ["vite@<=6.4.1", "6.4.2"],
  ["vite@>=7.0.0 <=7.3.1", "7.3.3"],
]);

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

test("consumer pack smoke writes local tarball overrides to pnpm-workspace.yaml", async () => {
  const smokeScript = await readRootFile("scripts/consumer-smoke-pack.mjs");

  assert.match(smokeScript, /pnpm-workspace\.yaml/);
  assert.doesNotMatch(smokeScript, /pnpm:\s*{\s*overrides/s);
});

test("swap example uses the patched Vite 6 line directly", async () => {
  const examplePackage = await readRootJson("examples/swap-dapp/package.json");

  assert.equal(examplePackage.devDependencies.vite, "6.4.2");
});

test("workspace test runners use the patched Vitest 4 line directly", async () => {
  const rootPackage = await readRootJson("package.json");
  const e2ePackage = await readRootJson("e2e-tests/package.json");
  const examplePackage = await readRootJson("examples/swap-dapp/package.json");

  assert.equal(rootPackage.devDependencies.vitest, "4.1.0");
  assert.equal(e2ePackage.devDependencies.vitest, "4.1.0");
  assert.equal(examplePackage.devDependencies.vitest, "4.1.0");
});

test("lockfile excludes Vite, esbuild, and Vitest advisory ranges", async () => {
  const lockfile = await readRootFile("pnpm-lock.yaml");

  assert.doesNotMatch(lockfile, /vite@5\.4\.21/);
  assert.doesNotMatch(lockfile, /vite@7\.3\.1/);
  assert.doesNotMatch(lockfile, /esbuild@0\.21\.5/);
  assert.doesNotMatch(lockfile, /vitest@3\.2\.4/);
  assert.match(lockfile, /vite@6\.4\.2/);
  assert.match(lockfile, /esbuild@0\.25\./);
  assert.match(lockfile, /vitest@4\.1\.0/);
});
