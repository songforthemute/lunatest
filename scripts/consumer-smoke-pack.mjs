import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import {
  createConsumerSmokeScript,
  reactPeerMatrix,
} from "./consumer-smoke-fixtures.mjs";
import { writeConsumerWorkflowFixture } from "./consumer-workflow-fixtures.mjs";
import { packageNames, publicPackages } from "./package-roster.mjs";
import {
  createTarballOverrides,
  formatWorkspaceOverrides,
} from "./pnpm-workspace-overrides.mjs";
import {
  packPackage,
  run,
  runAsync,
  startCommand,
  startJsonRpcClient,
} from "./smoke-helpers.mjs";

const tempRoot = mkdtempSync(join(tmpdir(), "lunatest-consumer-pack-"));
const tarballsDir = join(tempRoot, "tarballs");
const consumerDir = join(tempRoot, "consumer");

function assertCoverageContract(report) {
  assert.ok(report.coveredTargets.features.includes("swap"));
  assert.ok(report.missing.features.includes("approve"));
  assert.ok(report.known.features.includes("approve"));
}

async function runMcpProjectWorkflow(command, args, cwd, expectedId) {
  const client = startJsonRpcClient(command, args, cwd);

  try {
    const list = await client.request({ id: "list", method: "scenario.list" });
    assert.ok(Array.isArray(list.result));
    assert.ok(list.result.some((scenario) => scenario.id === expectedId));
    assert.equal(JSON.stringify(list.result).includes(consumerDir), false);

    return list;
  } finally {
    client.closeInput();
    try {
      await client.waitForExit();
    } finally {
      await client.dispose();
    }
  }
}

async function runPackedConsumerWorkflow(consumerDir) {
  const fixture = await writeConsumerWorkflowFixture(consumerDir);
  const validate = await runAsync("pnpm", ["exec", "lunatest", "validate"], consumerDir);
  const runResult = await runAsync("pnpm", ["exec", "lunatest", "run"], consumerDir);
  const coverage = await runAsync("pnpm", ["exec", "lunatest", "coverage"], consumerDir);
  const generation = await runAsync("pnpm", ["exec", "lunatest", "gen", "--ai"], consumerDir);

  assert.match(validate.stdout, /Validate Summary/);
  assert.match(validate.stdout, /failed=0/);
  assert.match(runResult.stdout, /Scenario Summary/);
  assert.match(runResult.stdout, /PASS swap-smoke/);
  assert.match(runResult.stdout, /failed=0/);
  assertCoverageContract(JSON.parse(coverage.stdout));
  assert.match(generation.stdout, /AI generation complete/);
  assert.match(generation.stdout, /created=1/);
  const generatedLua = readFileSync(fixture.generatedScenarioFile, "utf8");
  assert.match(generatedLua, /coverage = \{/);
  assert.match(generatedLua, /features = \{ "swap" \}/);
  assert.match(generatedLua, /states = \{ "quoteLoaded" \}/);
  assert.match(generatedLua, /components = \{ "quotePanel" \}/);
  assert.match(generatedLua, /tags = \{ "generated", "edge-case" \}/);

  const cliBin = join(consumerDir, "node_modules", ".bin", "lunatest");
  const watch = startCommand(cliBin, ["watch"], consumerDir);
  let watchExit;
  try {
    await watch.waitForOutput("Scenario Summary");
    await watch.waitForOutput("PASS swap-smoke");
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
    writeFileSync(fixture.scenarioFile, fixture.updatedScenario, "utf8");
    await watch.waitForOutput("PASS swap-smoke-updated");
  } finally {
    watchExit = await watch.stop("SIGINT");
  }
  assert.equal(watchExit.code, 0, `watch did not stop cleanly: ${JSON.stringify(watchExit)}`);

  const client = startJsonRpcClient("pnpm", ["exec", "lunatest-mcp"], consumerDir);
  try {
    const list = await client.request({ id: "list", method: "scenario.list" });
    const run = await client.request({
      id: "run",
      method: "scenario.run",
      params: { id: "scenarios/swap" },
    });
    const report = await client.request({ id: "coverage", method: "coverage.report" });
    const gaps = await client.request({ id: "gaps", method: "coverage.gaps" });

    assert.ok(Array.isArray(list.result));
    assert.ok(list.result.some((scenario) => scenario.id === "scenarios/swap"));
    assert.equal(JSON.stringify(list.result).includes(consumerDir), false);
    assert.equal(run.result.id, "scenarios/swap");
    assert.equal(run.result.pass, true);
    assertCoverageContract(report.result);
    assert.ok(
      gaps.result.some((gap) => gap.kind === "feature" && gap.id === "approve"),
    );
  } finally {
    client.closeInput();
    try {
      await client.waitForExit();
    } finally {
      await client.dispose();
    }
  }

  const siblingDir = join(dirname(consumerDir), "mcp-config-sibling");
  const mcpBin = join(consumerDir, "node_modules", ".bin", "lunatest-mcp");
  mkdirSync(siblingDir, { recursive: true });
  await runMcpProjectWorkflow(
    mcpBin,
    ["--config", fixture.configFile],
    siblingDir,
    "scenarios/swap",
  );

  const empty = startJsonRpcClient(mcpBin, ["--empty"], siblingDir);
  try {
    const list = await empty.request({ id: "empty-list", method: "scenario.list" });
    assert.deepEqual(list.result, []);
  } finally {
    empty.closeInput();
    try {
      await empty.waitForExit();
    } finally {
      await empty.dispose();
    }
  }
}

try {
  mkdirSync(tarballsDir, { recursive: true });

  const tarballs = publicPackages.map((pkg) => ({
    name: pkg.name,
    tarball: packPackage(resolve(process.cwd(), pkg.dir), tarballsDir),
  }));

  const workspaceOverrides = formatWorkspaceOverrides(createTarballOverrides(tarballs));

  for (const reactPeer of reactPeerMatrix) {
    const matrixConsumerDir = join(consumerDir, reactPeer.label);

    mkdirSync(matrixConsumerDir, { recursive: true });

    writeFileSync(
      join(matrixConsumerDir, "package.json"),
      JSON.stringify(
        {
          name: `lunatest-consumer-smoke-pack-${reactPeer.label}`,
          private: true,
          type: "module",
        },
        null,
        2,
      ),
    );

    writeFileSync(
      join(matrixConsumerDir, "pnpm-workspace.yaml"),
      `packages:
  - "."

minimumReleaseAge: 10080
blockExoticSubdeps: true

overrides:
${workspaceOverrides}
`,
    );

    run(
      "pnpm",
      ["add", ...reactPeer.dependencies, ...packageNames(publicPackages)],
      matrixConsumerDir,
      {
        stdio: "inherit",
      },
    );

    writeFileSync(
      join(matrixConsumerDir, "smoke.mjs"),
      createConsumerSmokeScript({ includeNextPackages: true }),
    );

    run("node", ["./smoke.mjs"], matrixConsumerDir, { stdio: "inherit" });
    run("pnpm", ["exec", "lunatest", "doctor"], matrixConsumerDir, { stdio: "inherit" });

    if (reactPeer.label === "react19") {
      await runPackedConsumerWorkflow(matrixConsumerDir);
    }

    const lockfile = readFileSync(join(matrixConsumerDir, "pnpm-lock.yaml"), "utf8");
    for (const packageName of packageNames(publicPackages)) {
      if (!lockfile.includes(packageName)) {
        throw new Error(`${packageName} package install not found in consumer lockfile`);
      }
    }

    process.stdout.write(`[consumer-smoke:pack] OK (${reactPeer.label})\n`);
  }
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
