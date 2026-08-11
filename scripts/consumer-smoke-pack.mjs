import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import {
  createConsumerSmokeScript,
  reactPeerMatrix,
} from "./consumer-smoke-fixtures.mjs";
import { createConsumerSmokeCommandPlan } from "./consumer-smoke-commands.mjs";
import {
  createConsumerWorkflowFixture,
  writeConsumerWorkflowFixture,
} from "./consumer-workflow-fixtures.mjs";
import { packageNames, publicPackages } from "./package-roster.mjs";
import {
  createTarballOverrides,
  formatWorkspaceOverrides,
} from "./pnpm-workspace-overrides.mjs";
import {
  closeInputAndWaitForExit,
  packPackage,
  resolveInstalledPackageBin,
  run,
  runAsync,
  startCommand,
  startJsonRpcClient,
} from "./smoke-helpers.mjs";

const tempRoot = mkdtempSync(join(tmpdir(), "lunatest-consumer-pack-"));
const tarballsDir = join(tempRoot, "tarballs");
const consumerDir = join(tempRoot, "consumer");
const WATCH_RERUN_TIMEOUT_MS = 10_000;
const WATCH_RERUN_ATTEMPT_TIMEOUT_MS = 750;
const consumerConfigPath = createConsumerWorkflowFixture().configPath;

function assertCoverageContract(report) {
  assert.ok(report.coveredTargets.features.includes("swap"));
  assert.ok(report.missing.features.includes("approve"));
  assert.ok(report.known.features.includes("approve"));
}

async function runMcpProjectWorkflow(invocation, cwd, expectedId, options = {}) {
  const client = startJsonRpcClient(invocation.command, invocation.args, cwd, {
    ...options,
    shell: invocation.shell,
  });

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

async function waitForWatchRerun(watch, scenarioFile, updatedScenario) {
  const deadline = Date.now() + WATCH_RERUN_TIMEOUT_MS;
  let attempts = 0;
  let lastError;

  while (Date.now() < deadline) {
    attempts += 1;
    writeFileSync(
      scenarioFile,
      `${updatedScenario.trimEnd()}\n-- consumer-watch-touch=${attempts}\n`,
      "utf8",
    );

    const remaining = deadline - Date.now();
    try {
      await watch.waitForOutput(
        "PASS swap-smoke-updated",
        Math.min(WATCH_RERUN_ATTEMPT_TIMEOUT_MS, remaining),
      );
      return;
    } catch (error) {
      lastError = error;
      if (watch.snapshot().exitResult) {
        break;
      }
    }
  }

  throw new Error(
    [
      `Watch did not report the updated scenario after ${attempts} writes`,
      lastError instanceof Error ? lastError.message : String(lastError),
    ].join("\n"),
  );
}

async function runPackedConsumerWorkflow(consumerDir, commands) {
  const fixture = await writeConsumerWorkflowFixture(consumerDir);
  const validate = await runAsync(commands.cli.validate.command, commands.cli.validate.args, consumerDir, {
    shell: commands.cli.validate.shell,
  });
  const runResult = await runAsync(commands.cli.run.command, commands.cli.run.args, consumerDir, {
    shell: commands.cli.run.shell,
  });
  const coverage = await runAsync(commands.cli.coverage.command, commands.cli.coverage.args, consumerDir, {
    shell: commands.cli.coverage.shell,
  });
  const generation = await runAsync(commands.cli.generate.command, commands.cli.generate.args, consumerDir, {
    shell: commands.cli.generate.shell,
  });

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

  const watch = startCommand(commands.cli.watch.command, commands.cli.watch.args, consumerDir, {
    shell: commands.cli.watch.shell,
  });
  let watchExit;
  try {
    await watch.waitForOutput("Scenario Summary");
    await watch.waitForOutput("PASS swap-smoke");
    await waitForWatchRerun(watch, fixture.scenarioFile, fixture.updatedScenario);
  } finally {
    watchExit = await closeInputAndWaitForExit(watch);
  }
  assert.equal(watchExit.code, 0, `watch did not stop cleanly: ${JSON.stringify(watchExit)}`);

  const client = startJsonRpcClient(commands.mcp.default.command, commands.mcp.default.args, consumerDir, {
    shell: commands.mcp.default.shell,
  });
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
  mkdirSync(siblingDir, { recursive: true });
  await runMcpProjectWorkflow(
    commands.mcp.project,
    siblingDir,
    "scenarios/swap",
  );

  const empty = startJsonRpcClient(
    commands.mcp.empty.command,
    commands.mcp.empty.args,
    siblingDir,
    { shell: commands.mcp.empty.shell },
  );
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

  for (const reactPeer of reactPeerMatrix) {
    const matrixConsumerDir = join(consumerDir, reactPeer.label);

    mkdirSync(matrixConsumerDir, { recursive: true });
    const workspaceOverrides = formatWorkspaceOverrides(
      createTarballOverrides(tarballs, matrixConsumerDir),
    );

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
      createConsumerSmokeScript({ includeRunnerPackages: true }),
    );

    const cliBin = resolveInstalledPackageBin("@lunatest/cli", "lunatest", matrixConsumerDir);
    const mcpBin = resolveInstalledPackageBin("@lunatest/mcp", "lunatest-mcp", matrixConsumerDir);
    const commands = createConsumerSmokeCommandPlan({
      cliBin,
      mcpBin,
      configPath: join(matrixConsumerDir, consumerConfigPath),
    });
    run("node", ["./smoke.mjs"], matrixConsumerDir, { stdio: "inherit" });
    run(commands.cli.doctor.command, commands.cli.doctor.args, matrixConsumerDir, {
      shell: commands.cli.doctor.shell,
      stdio: "inherit",
    });

    if (reactPeer.label === "react19") {
      await runPackedConsumerWorkflow(matrixConsumerDir, commands);
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
