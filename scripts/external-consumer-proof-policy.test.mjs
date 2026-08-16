import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  assertExactDependencyPins,
  assertFixtureSourceIsolation,
  assertRegistryPackageSet,
  assertResolutionIsolation,
} from "./external-consumer-proof-policy.mjs";
import { packageNames, publicPackages } from "./package-roster.mjs";
import {
  fixtureDir,
  parseExternalConsumerProofLane,
  parseExternalConsumerProofOptions,
  repositoryRoot,
} from "./run-external-consumer-proof.mjs";
import { prepareWagmiQuickstart } from "./validate-wagmi-quickstart.mjs";
const manifest = JSON.parse(readFileSync(join(fixtureDir, "package.json"), "utf8"));
const runnerSource = readFileSync(
  join(repositoryRoot, "scripts", "run-external-consumer-proof.mjs"),
  "utf8",
);
const quickstartValidatorSource = readFileSync(
  join(repositoryRoot, "scripts", "validate-wagmi-quickstart.mjs"),
  "utf8",
);

test("reference fixture pins the supported real wagmi and viem boundary", () => {
  assertExactDependencyPins(manifest);
  assert.equal(manifest.dependencies["@wagmi/core"], "3.6.4");
  assert.equal(manifest.dependencies.viem, "2.55.11");
  assert.equal(manifest.dependencies.react, "19.2.8");
  assert.equal(manifest.devDependencies["@playwright/test"], "1.61.1");
  assert.equal(manifest.devDependencies.vitest, "4.1.6");

  const recordedPackages = new Set([
    ...Object.keys(manifest.dependencies),
    ...Object.keys(manifest.devDependencies),
  ]);
  assert.deepEqual(
    packageNames(publicPackages).filter((name) => !recordedPackages.has(name)),
    [],
  );
});

test("reference fixture remains independent from workspace source", () => {
  assertFixtureSourceIsolation(fixtureDir, repositoryRoot);
  const workspace = readFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), "utf8");
  const fixtureWorkspace = readFileSync(join(fixtureDir, "pnpm-workspace.yaml"), "utf8");
  assert.doesNotMatch(workspace, /consumer-proof/);
  for (const packageName of packageNames(publicPackages)) {
    assert.match(fixtureWorkspace, new RegExp(packageName.replace("/", "\\/")));
  }
  assert.match(readFileSync(join(fixtureDir, "src", "wagmi.ts"), "utf8"), /createConfig/);
  assert.doesNotMatch(readFileSync(join(fixtureDir, "src", "App.tsx"), "utf8"), /@lunatest\//);
  assert.match(
    runnerSource,
    /run\("pnpm", \["run", "test:vitest"\][\s\S]*run\("pnpm", \["run", "test:browser"\]/,
  );
  const sharedScenario = readFileSync(
    join(fixtureDir, "scenarios", "approve-and-swap.lua"),
    "utf8",
  );
  assert.match(sharedScenario, /stages = \{/);
  assert.match(sharedScenario, /then_ui = \{/);
  assert.match(sharedScenario, /then_state = \{/);
  for (const runner of ["journey.test.ts", "journey.spec.ts"]) {
    assert.match(
      readFileSync(join(fixtureDir, "tests", runner), "utf8"),
      /SWAP_SCENARIO_ID/,
    );
  }
});

test("lane parser defaults to pack and rejects unknown lanes", () => {
  assert.equal(parseExternalConsumerProofLane([]), "pack");
  assert.equal(parseExternalConsumerProofLane(["--lane=registry"]), "registry");
  assert.throws(
    () => parseExternalConsumerProofLane(["--lane=workspace"]),
    /Unsupported external consumer proof lane/,
  );
});

test("proof options select a portable output and CI-only budget enforcement", () => {
  assert.deepEqual(parseExternalConsumerProofOptions([]), {
    enforceCiBudget: false,
    outputPath: undefined,
    releasePackageSet: false,
  });
  assert.deepEqual(
    parseExternalConsumerProofOptions([
      "--output=artifacts/custom.json",
      "--enforce-ci-budget",
      "--release-package-set",
    ]),
    {
      enforceCiBudget: true,
      outputPath: "artifacts/custom.json",
      releasePackageSet: true,
    },
  );
  assert.match(runnerSource, /LUNATEST_PROOF_RUNS: "30"/);
  assert.doesNotMatch(runnerSource, /if \(lane === "pack"\) \{\s*const proofEnv/);
  assert.match(runnerSource, /source: lane === "registry" \? "npm-registry" : "packed-tarball"/);
  assert.match(runnerSource, /external-consumer-proof\/\$\{lane\}\.json/);
  assert.match(runnerSource, /createExternalConsumerProofReport/);
  assert.match(runnerSource, /writeExternalConsumerProofReport/);
});

test("registry package-set audit requires exact latest versions and integrity", () => {
  const names = packageNames(publicPackages);
  const versions = Object.fromEntries(names.map((name, index) => [name, `1.0.${index}`]));
  const manifest = { dependencies: { ...versions } };
  const lockfile = [
    "importers:",
    "  .:",
    "    dependencies:",
    ...names.flatMap((name) => [
      `      '${name}':`,
      `        specifier: ${versions[name]}`,
      `        version: ${versions[name]}`,
    ]),
    "packages:",
    ...names.flatMap((name) => [
      `  '${name}@${versions[name]}':`,
      "    resolution: {integrity: sha512-proof}",
    ]),
  ].join("\n");

  assert.doesNotThrow(() =>
    assertRegistryPackageSet({
      expectedVersions: versions,
      latestVersions: versions,
      lockfile,
      manifest,
      packageNames: names,
    }),
  );
  assert.throws(
    () =>
      assertRegistryPackageSet({
        expectedVersions: versions,
        latestVersions: { ...versions, [names[0]]: "9.9.9" },
        lockfile,
        manifest,
        packageNames: names,
      }),
    /registry latest mismatch/,
  );
  assert.throws(
    () =>
      assertRegistryPackageSet({
        expectedVersions: versions,
        latestVersions: versions,
        lockfile: lockfile.replace("resolution: {integrity: sha512-proof}", "resolution: {}"),
        manifest,
        packageNames: names,
      }),
    /missing integrity/,
  );
});

test("quickstart validator starts from the pinned Vite scaffold before packed proof", () => {
  assert.match(quickstartValidatorSource, /create-vite@9\.1\.2/);
  assert.match(quickstartValidatorSource, /resolveInstalledPackageBin/);
  assert.match(quickstartValidatorSource, /"wagmi-swap", "--template", "react-ts"/);
  assert.match(quickstartValidatorSource, /cpSync\(fixtureDir, targetDir/);
  assert.match(quickstartValidatorSource, /runExternalConsumerProof\("pack"/);
  assert.match(runnerSource, /options\.fixtureDir/);
});

test("quickstart validator prepares the pinned scaffold in a temporary directory", () => {
  const prepared = prepareWagmiQuickstart();
  try {
    const preparedManifest = JSON.parse(
      readFileSync(join(prepared.targetDir, "package.json"), "utf8"),
    );
    assert.equal(preparedManifest.name, "lunatest-wagmi-swap-proof");
    assert.equal(preparedManifest.dependencies.react, "19.2.8");
    assert.equal(
      readFileSync(join(prepared.targetDir, "scenarios", "approve-and-swap.lua"), "utf8")
        .includes('name = "approve-and-swap"'),
      true,
    );
  } finally {
    rmSync(prepared.tempRoot, { recursive: true, force: true });
  }
});

test("resolution policy permits only staged tarballs in the pack lane", () => {
  const root = mkdtempSync(join(tmpdir(), "lunatest-proof-policy-"));
  const consumerDir = join(root, "consumer");
  const tarballsDir = join(root, "tarballs");
  mkdirSync(consumerDir);
  mkdirSync(tarballsDir);
  writeFileSync(join(tarballsDir, "lunatest-core.tgz"), "fixture");
  const expectedTarballOverrides = {
    "@lunatest/core": "file:../tarballs/lunatest-core.tgz",
  };

  try {
    assert.doesNotThrow(() =>
      assertResolutionIsolation({
        lane: "pack",
        lockfile: [
          "  '@lunatest/core':",
          "    version: file:../tarballs/lunatest-core.tgz",
        ].join("\n"),
        workspaceConfig: 'overrides:\n  "@lunatest/core": "file:../tarballs/lunatest-core.tgz"',
        consumerDir,
        tarballsDir,
        repositoryRoot,
        expectedTarballOverrides,
      }),
    );
    assert.throws(
      () =>
        assertResolutionIsolation({
          lane: "pack",
          lockfile: "resolution: file:../source/package.json",
          workspaceConfig: "overrides:",
          consumerDir,
          tarballsDir,
          repositoryRoot,
          expectedTarballOverrides,
        }),
      /not a staged tarball/,
    );
    assert.throws(
      () =>
        assertResolutionIsolation({
          lane: "pack",
          lockfile: "specifier: workspace:*",
          workspaceConfig: "overrides:",
          consumerDir,
          tarballsDir,
          repositoryRoot,
          expectedTarballOverrides,
        }),
      /forbidden resolution marker/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("pack resolution policy rejects a LunaTest registry fallback", () => {
  const root = mkdtempSync(join(tmpdir(), "lunatest-proof-fallback-"));
  const consumerDir = join(root, "consumer");
  const tarballsDir = join(root, "tarballs");
  mkdirSync(consumerDir);
  mkdirSync(tarballsDir);
  writeFileSync(join(tarballsDir, "lunatest-core.tgz"), "fixture");
  writeFileSync(join(tarballsDir, "lunatest-react.tgz"), "fixture");

  try {
    assert.throws(
      () =>
        assertResolutionIsolation({
          lane: "pack",
          lockfile: [
            "  '@lunatest/core':",
            "    version: file:../tarballs/lunatest-core.tgz",
            "  '@lunatest/react@0.1.5':",
            "    resolution: {integrity: sha512-registry}",
          ].join("\n"),
          workspaceConfig:
            'overrides:\n  "@lunatest/core": "file:../tarballs/lunatest-core.tgz"',
          consumerDir,
          tarballsDir,
          repositoryRoot,
          expectedTarballOverrides: {
            "@lunatest/core": "file:../tarballs/lunatest-core.tgz",
            "@lunatest/react": "file:../tarballs/lunatest-react.tgz",
          },
        }),
      /do not match|missing the staged override|does not resolve|registry fallback/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("registry resolution policy rejects local and override installs", () => {
  const input = {
    lane: "registry",
    consumerDir: fixtureDir,
    tarballsDir: fixtureDir,
    repositoryRoot,
  };

  assert.doesNotThrow(() =>
    assertResolutionIsolation({
      ...input,
      lockfile: "resolution: {integrity: sha512-proof}",
      workspaceConfig: 'packages:\n  - "."',
    }),
  );
  assert.throws(
    () =>
      assertResolutionIsolation({
        ...input,
        lockfile: "resolution: file:../lunatest-core.tgz",
        workspaceConfig: 'packages:\n  - "."',
      }),
    /registry lane contains forbidden resolution marker/,
  );
  assert.throws(
    () =>
      assertResolutionIsolation({
        ...input,
        lockfile: "resolution: {integrity: sha512-proof}",
        workspaceConfig: "overrides:\n  @lunatest/core: 0.2.0",
      }),
    /registry lane contains forbidden resolution marker/,
  );
});
