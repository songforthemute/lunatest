import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import test from "node:test";
import { join } from "node:path";

import { createConsumerWorkflowFixture } from "./consumer-workflow-fixtures.mjs";
import * as smokeHelpers from "./smoke-helpers.mjs";
import {
  closeInputAndWaitForExit,
  createJsonRpcClient,
  resolveInstalledPackageBin,
} from "./smoke-helpers.mjs";

function createFakeProcess({ writeErrors = [], waitForExitImpl } = {}) {
  const stdoutListeners = new Set();
  const inputErrorListeners = new Set();
  const pendingWriteErrors = [...writeErrors];
  let stdout = "";
  let stderr = "";

  return {
    command: "lunatest-mcp",
    args: ["--empty"],
    writes: [],
    closeInputCalls: 0,
    stopCalls: 0,
    stopSignals: [],
    onStdout(listener) {
      stdoutListeners.add(listener);
      return () => stdoutListeners.delete(listener);
    },
    stdoutListenerCount() {
      return stdoutListeners.size;
    },
    onInputError(listener) {
      inputErrorListeners.add(listener);
      return () => inputErrorListeners.delete(listener);
    },
    inputErrorListenerCount() {
      return inputErrorListeners.size;
    },
    write(input) {
      const writeError = pendingWriteErrors.shift();
      if (writeError) {
        throw writeError;
      }
      this.writes.push(input);
    },
    closeInput() {
      this.closeInputCalls += 1;
    },
    snapshot() {
      return {
        command: this.command,
        args: this.args,
        stdout,
        stderr,
      };
    },
    async waitForExit(timeoutMs) {
      return waitForExitImpl?.(timeoutMs) ?? { code: 0, signal: null };
    },
    async stop(signal) {
      this.stopCalls += 1;
      this.stopSignals.push(signal);
      return { code: 0, signal: null };
    },
    emitStdout(chunk) {
      stdout += chunk;
      for (const listener of stdoutListeners) {
        listener(chunk);
      }
    },
    emitStderr(chunk) {
      stderr += chunk;
    },
    emitInputError(error) {
      for (const listener of inputErrorListeners) {
        listener(error);
      }
    },
  };
}

function createInstalledPackageFixture({ packageName, bin }) {
  const consumerDir = mkdtempSync(join(tmpdir(), "lunatest-installed-bin-"));
  const packageDir = join(consumerDir, "node_modules", ...packageName.split("/"));
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(
    join(packageDir, "package.json"),
    JSON.stringify({ name: packageName, bin }),
    "utf8",
  );

  return {
    consumerDir,
    packageDir,
    writeBin(relativePath) {
      const binPath = join(packageDir, relativePath);
      mkdirSync(join(binPath, ".."), { recursive: true });
      writeFileSync(binPath, "#!/usr/bin/env node\n", "utf8");
      return binPath;
    },
    cleanup() {
      rmSync(consumerDir, { recursive: true, force: true });
    },
  };
}

test("consumer workflow fixture defines the configured scenario and deterministic AI adapter", () => {
  const fixture = createConsumerWorkflowFixture();
  const config = JSON.parse(fixture.files[fixture.configPath]);

  assert.deepEqual(config, {
    scenarioDir: "scenarios",
    luaConfigPath: "lunatest.lua",
    coverageCatalog: {
      features: ["swap", "approve"],
      states: ["quoteLoaded", "approvalPending"],
      components: ["quotePanel", "actionButtonRow"],
    },
    ai: {
      command: "node",
      args: ["./adapter.mjs"],
    },
  });
  assert.match(fixture.files[fixture.scenarioPath], /name = "swap-smoke"/);
  assert.match(fixture.files[fixture.scenarioPath], /coverage = \{/);
  assert.match(fixture.files[fixture.aiAdapterPath], /for await \(const chunk of process\.stdin\)/);
  assert.match(
    fixture.files[fixture.aiAdapterPath],
    /item\.source/,
  );
  assert.doesNotMatch(fixture.files[fixture.aiAdapterPath], /item\.id === "scenarios\/swap"/);
  assert.match(fixture.files[fixture.aiAdapterPath], /generated-edge-case/);
  assert.match(fixture.updatedScenario, /name = "swap-smoke-updated"/);
});

test("command invocation resolver runs Windows pnpm through cmd.exe without a shell", () => {
  const pnpmArgs = ["exec", "lunatest", "validate"];

  assert.deepEqual(
    smokeHelpers.resolveCommandInvocation("pnpm", pnpmArgs, {
      platform: "win32",
      comSpec: "C:\\Windows\\System32\\cmd.exe",
    }),
    {
      command: "C:\\Windows\\System32\\cmd.exe",
      args: ["/d", "/c", "pnpm.cmd", ...pnpmArgs],
      shell: false,
    },
  );
  assert.deepEqual(
    smokeHelpers.resolveCommandInvocation("pnpm", pnpmArgs, { platform: "linux" }),
    { command: "pnpm", args: pnpmArgs, shell: false },
  );
  assert.deepEqual(
    smokeHelpers.resolveCommandInvocation("node", ["smoke.mjs"], { platform: "win32" }),
    { command: "node", args: ["smoke.mjs"], shell: false },
  );
  assert.deepEqual(
    smokeHelpers.resolveCommandInvocation("node", ["smoke.mjs"], {
      platform: "win32",
      shell: true,
    }),
    { command: "node", args: ["smoke.mjs"], shell: true },
  );
});

test("installed package version guard rejects a stale registry fallback", (t) => {
  assert.equal(typeof smokeHelpers.assertInstalledPackageVersions, "function");

  const consumerDir = mkdtempSync(join(tmpdir(), "lunatest-installed-version-"));
  t.after(() => rmSync(consumerDir, { recursive: true, force: true }));
  const expectedVersions = {
    "@lunatest/core": "0.2.0",
    "@lunatest/playwright-plugin": "0.2.0",
  };

  for (const [packageName, version] of Object.entries(expectedVersions)) {
    const packageDir = join(consumerDir, "node_modules", ...packageName.split("/"));
    mkdirSync(packageDir, { recursive: true });
    writeFileSync(join(packageDir, "package.json"), JSON.stringify({ name: packageName, version }));
  }

  assert.doesNotThrow(() => smokeHelpers.assertInstalledPackageVersions(consumerDir, expectedVersions));
  writeFileSync(
    join(consumerDir, "node_modules", "@lunatest", "playwright-plugin", "package.json"),
    JSON.stringify({ name: "@lunatest/playwright-plugin", version: "0.1.2" }),
  );
  assert.throws(
    () => smokeHelpers.assertInstalledPackageVersions(consumerDir, expectedVersions),
    /@lunatest\/playwright-plugin.*expected 0\.2\.0.*received 0\.1\.2/,
  );
});

test("MCP smoke invocation and Windows Node CLI adapter tree cleanup use safe process invocations", (t) => {
  const fixture = createInstalledPackageFixture({
    packageName: "@lunatest/mcp",
    bin: { "lunatest-mcp": "./dist/bin/mcp-stdio.js" },
  });
  t.after(() => fixture.cleanup());
  const binPath = fixture.writeBin("dist/bin/mcp-stdio.js");

  assert.deepEqual(smokeHelpers.resolveMcpSmokeInvocation(fixture.consumerDir), {
    command: process.execPath,
    args: [binPath, "--empty"],
    shell: false,
  });

  const taskkillCalls = [];
  const nodeChild = {
    command: process.execPath,
    pid: 4242,
    killCalls: [],
    kill(signal) {
      this.killCalls.push(signal);
    },
  };

  smokeHelpers.terminateCommandProcess(
    nodeChild,
    {
      platform: "win32",
      runSync(command, args, options) {
        taskkillCalls.push({ command, args, options });
        return { status: 0 };
      },
    },
  );

  assert.deepEqual(taskkillCalls, [
    {
      command: "taskkill.exe",
      args: ["/pid", "4242", "/T", "/F"],
      options: { shell: false, stdio: "ignore" },
    },
  ]);
  assert.deepEqual(nodeChild.killCalls, []);

  const posixChild = {
    command: process.execPath,
    pid: 4242,
    killCalls: [],
    kill(signal) {
      this.killCalls.push(signal);
    },
  };
  smokeHelpers.terminateCommandProcess(
    posixChild,
    {
      platform: "linux",
      runSync() {
        throw new Error("taskkill should not run on POSIX");
      },
    },
  );

  assert.deepEqual(posixChild.killCalls, ["SIGTERM"]);
});

test("consumer smoke command plan keeps every CLI and MCP flow Node-direct", async () => {
  const { createConsumerSmokeCommandPlan } = await import("./consumer-smoke-commands.mjs");
  const cliBin = { command: process.execPath, args: ["/fixtures/cli.mjs"], shell: false };
  const mcpBin = { command: process.execPath, args: ["/fixtures/mcp.mjs"], shell: false };

  assert.deepEqual(
    createConsumerSmokeCommandPlan({
      cliBin,
      mcpBin,
      configPath: "/fixtures/lunatest.config.json",
    }),
    {
      cli: {
        validate: { command: process.execPath, args: ["/fixtures/cli.mjs", "validate"], shell: false },
        run: { command: process.execPath, args: ["/fixtures/cli.mjs", "run"], shell: false },
        coverage: { command: process.execPath, args: ["/fixtures/cli.mjs", "coverage"], shell: false },
        generate: { command: process.execPath, args: ["/fixtures/cli.mjs", "gen", "--ai"], shell: false },
        watch: { command: process.execPath, args: ["/fixtures/cli.mjs", "watch"], shell: false },
        doctor: { command: process.execPath, args: ["/fixtures/cli.mjs", "doctor"], shell: false },
      },
      mcp: {
        default: { command: process.execPath, args: ["/fixtures/mcp.mjs"], shell: false },
        project: {
          command: process.execPath,
          args: ["/fixtures/mcp.mjs", "--config", "/fixtures/lunatest.config.json"],
          shell: false,
        },
        empty: { command: process.execPath, args: ["/fixtures/mcp.mjs", "--empty"], shell: false },
      },
    },
  );
});

test("installed package bin resolver runs manifest bins through Node on every platform", (t) => {
  const fixture = createInstalledPackageFixture({
    packageName: "@lunatest/cli",
    bin: { lunatest: "./dist/index.js" },
  });
  t.after(() => fixture.cleanup());
  const binPath = fixture.writeBin("dist/index.js");

  const resolved = resolveInstalledPackageBin(
    "@lunatest/cli",
    "lunatest",
    fixture.consumerDir,
  );

  assert.deepEqual(resolved, {
    command: process.execPath,
    args: [binPath],
    shell: false,
  });
  assert.deepEqual([...resolved.args, "watch"], [binPath, "watch"]);

  for (const platform of ["linux", "win32"]) {
    assert.equal(resolved.command, process.execPath, `${platform} uses Node directly`);
    assert.equal(resolved.shell, false, `${platform} does not launch a shell shim`);
    assert.equal(resolved.args[0].endsWith(".cmd"), false, `${platform} does not use .cmd`);
  }
});

test("installed package bin resolver supports string bin entries", (t) => {
  const fixture = createInstalledPackageFixture({
    packageName: "@lunatest/mcp",
    bin: "./dist/bin/mcp-stdio.js",
  });
  t.after(() => fixture.cleanup());
  const binPath = fixture.writeBin("dist/bin/mcp-stdio.js");

  assert.deepEqual(
    resolveInstalledPackageBin("@lunatest/mcp", "lunatest-mcp", fixture.consumerDir),
    {
      command: process.execPath,
      args: [binPath],
      shell: false,
    },
  );
});

test("installed package bin resolver reports missing or invalid package bin entries", (t) => {
  const missingPackageDir = mkdtempSync(join(tmpdir(), "lunatest-missing-bin-"));
  t.after(() => rmSync(missingPackageDir, { recursive: true, force: true }));
  assert.throws(
    () => resolveInstalledPackageBin("@lunatest/mcp", "lunatest-mcp", missingPackageDir),
    /Unable to read installed package manifest for @lunatest\/mcp/,
  );

  const missingBin = createInstalledPackageFixture({
    packageName: "@lunatest/mcp",
    bin: { other: "./dist/other.js" },
  });
  t.after(() => missingBin.cleanup());
  assert.throws(
    () => resolveInstalledPackageBin("@lunatest/mcp", "lunatest-mcp", missingBin.consumerDir),
    /does not declare the lunatest-mcp bin entry/,
  );

  const invalidBin = createInstalledPackageFixture({
    packageName: "@lunatest/mcp",
    bin: { "lunatest-mcp": "../outside.js" },
  });
  t.after(() => invalidBin.cleanup());
  assert.throws(
    () => resolveInstalledPackageBin("@lunatest/mcp", "lunatest-mcp", invalidBin.consumerDir),
    /must be a relative file path inside its package/,
  );
});

test("EOF shutdown force-stops a watch process only after its graceful exit times out", async () => {
  const process = createFakeProcess({
    waitForExitImpl: async () => {
      throw new Error("watch exit timed out");
    },
  });

  await assert.rejects(
    () => closeInputAndWaitForExit(process),
    /watch exit timed out/,
  );

  assert.equal(process.closeInputCalls, 1);
  assert.equal(process.stopCalls, 1);
  assert.deepEqual(process.stopSignals, ["SIGKILL"]);
});

test("JSON-RPC client correlates typed response IDs from its process stream", async () => {
  const process = createFakeProcess();
  const client = createJsonRpcClient(process);

  const numeric = client.request({ id: 7, method: "numeric" });
  const text = client.request({ id: "7", method: "text" });
  const nullable = client.request({ id: null, method: "nullable" });

  assert.deepEqual(process.writes.map((input) => JSON.parse(input)), [
    { id: 7, method: "numeric" },
    { id: "7", method: "text" },
    { id: null, method: "nullable" },
  ]);
  process.emitStdout(`${JSON.stringify({ id: "7", result: "text" })}\n`);
  process.emitStdout(`${JSON.stringify({ id: null, result: "null" })}\n`);
  process.emitStdout(`${JSON.stringify({ id: 7, result: "numeric" })}\n`);

  assert.deepEqual(await numeric, { id: 7, result: "numeric" });
  assert.deepEqual(await text, { id: "7", result: "text" });
  assert.deepEqual(await nullable, { id: null, result: "null" });
  const firstSequential = client.request({ id: "first-sequential", method: "sequential" });
  process.emitStdout(
    `${JSON.stringify({ id: "first-sequential", result: "first" })}\n`,
  );
  assert.deepEqual(await firstSequential, {
    id: "first-sequential",
    result: "first",
  });
  assert.equal(process.stdoutListenerCount(), 1);

  const sequential = client.request({ id: "after-first-response", method: "sequential" });
  process.emitStdout(
    `${JSON.stringify({ id: "after-first-response", result: "still-subscribed" })}\n`,
  );
  assert.deepEqual(await sequential, {
    id: "after-first-response",
    result: "still-subscribed",
  });
  assert.equal(client.pendingRequestCount(), 0);
  await client.dispose();
  assert.equal(process.stdoutListenerCount(), 0);
  assert.equal(process.stopCalls, 1);
});

test("JSON-RPC client retains stream subscriptions after a non-terminal exit wait fails", async () => {
  const process = createFakeProcess({
    waitForExitImpl() {
      throw new Error("exit wait timed out");
    },
  });
  const client = createJsonRpcClient(process);

  const pending = client.request({ id: "pending-during-exit-wait", method: "scenario.list" });
  await assert.rejects(client.waitForExit(), /exit wait timed out/);
  assert.equal(process.stdoutListenerCount(), 1);
  assert.equal(process.inputErrorListenerCount(), 1);

  process.emitStdout(
    `${JSON.stringify({ id: "pending-during-exit-wait", result: [] })}\n`,
  );
  assert.deepEqual(await pending, { id: "pending-during-exit-wait", result: [] });

  const request = client.request({ id: "after-wait-timeout", method: "scenario.list" });
  process.emitStdout(
    `${JSON.stringify({ id: "after-wait-timeout", result: [] })}\n`,
  );
  assert.deepEqual(await request, { id: "after-wait-timeout", result: [] });

  await client.dispose();
  assert.equal(process.stdoutListenerCount(), 0);
  assert.equal(process.inputErrorListenerCount(), 0);
});

test("JSON-RPC client closes input and releases pending requests when the process exits", async () => {
  const process = createFakeProcess();
  const client = createJsonRpcClient(process);
  const pending = client.request({ id: "closed-before-response", method: "scenario.run" });

  client.closeInput();
  const [pendingResult, exitResult] = await Promise.allSettled([
    pending,
    client.waitForExit(),
  ]);

  assert.equal(exitResult.status, "fulfilled");
  assert.deepEqual(exitResult.value, { code: 0, signal: null });
  assert.equal(pendingResult.status, "rejected");
  assert.match(
    pendingResult.reason.message,
    /Exited before pending JSON-RPC requests completed/,
  );
  assert.equal(process.closeInputCalls, 1);
  assert.equal(client.pendingRequestCount(), 0);
  assert.equal(process.stdoutListenerCount(), 0);
  assert.equal(process.inputErrorListenerCount(), 0);
});

test("JSON-RPC client rejects unknown response IDs and clears pending requests", async () => {
  const process = createFakeProcess();
  const client = createJsonRpcClient(process);
  const pending = client.request({ id: "expected", method: "scenario.list" });

  process.emitStdout(`${JSON.stringify({ id: "unexpected", result: [] })}\n`);

  await assert.rejects(pending, /Unexpected JSON-RPC response ID: "unexpected"/);
  assert.equal(client.pendingRequestCount(), 0);
  await client.dispose();
  assert.equal(process.stopCalls, 1);
});

test("JSON-RPC client rejects invalid stdout with diagnostics without unhandled rejections", async () => {
  const process = createFakeProcess();
  const client = createJsonRpcClient(process);
  const unhandled = [];
  const onUnhandledRejection = (error) => unhandled.push(error);
  globalThis.process.on("unhandledRejection", onUnhandledRejection);

  try {
    process.emitStderr("ERR_PNPM_RECURSIVE_EXEC_NO_PACKAGE");
    const pending = client.request({ id: "invalid-output", method: "scenario.list" });
    process.emitStdout("ERR_PNPM_RECURSIVE_EXEC_NO_PACKAGE\n");

    await assert.rejects(pending, (error) => {
      assert.match(error.message, /Command failed: lunatest-mcp --empty/);
      assert.match(error.message, /Invalid JSON-RPC response: ERR_PNPM_RECURSIVE_EXEC_NO_PACKAGE/);
      assert.match(error.message, /stdout:\nERR_PNPM_RECURSIVE_EXEC_NO_PACKAGE/);
      assert.match(error.message, /stderr:\nERR_PNPM_RECURSIVE_EXEC_NO_PACKAGE/);
      return true;
    });
    assert.equal(client.pendingRequestCount(), 0);

    await client.dispose();
    await new Promise((resolveOutcome) => setImmediate(resolveOutcome));
    assert.deepEqual(unhandled, []);
    assert.equal(process.stopCalls, 1);
  } finally {
    globalThis.process.removeListener("unhandledRejection", onUnhandledRejection);
  }
});

test("JSON-RPC client timeout includes process output and releases the pending request", async () => {
  const process = createFakeProcess();
  const client = createJsonRpcClient(process, { timeoutMs: 5 });
  process.emitStdout("partial stdout");
  process.emitStderr("adapter stderr");

  await assert.rejects(
    client.request({ id: "slow", method: "scenario.run" }),
    (error) => {
      assert.match(error.message, /Command failed: lunatest-mcp --empty/);
      assert.match(error.message, /Timed out after 5 ms/);
      assert.match(error.message, /stdout:\npartial stdout/);
      assert.match(error.message, /stderr:\nadapter stderr/);
      return true;
    },
  );
  assert.equal(client.pendingRequestCount(), 0);
  await client.dispose();
  assert.equal(process.stopCalls, 1);
});

test("JSON-RPC client atomically rejects synchronous stdin write failures", async () => {
  const fakeProcess = createFakeProcess({
    writeErrors: [undefined, new Error("sync EPIPE")],
  });
  const client = createJsonRpcClient(fakeProcess);
  const unhandled = [];
  const onUnhandledRejection = (error) => unhandled.push(error);
  globalThis.process.on("unhandledRejection", onUnhandledRejection);

  try {
    const alreadyPending = client.request({ id: "already-pending", method: "scenario.list" });
    const writeFailure = client.request({ id: "write-failure", method: "scenario.run" });
    const results = await Promise.allSettled([alreadyPending, writeFailure]);

    assert.equal(results.length, 2);
    for (const result of results) {
      assert.equal(result.status, "rejected");
      assert.match(
        result.reason.message,
        /Command failed: lunatest-mcp --empty\nUnable to write JSON-RPC request: sync EPIPE/,
      );
    }
    assert.equal(client.pendingRequestCount(), 0);
    assert.equal(fakeProcess.inputErrorListenerCount(), 1);
    await client.dispose();
    await new Promise((resolveOutcome) => setImmediate(resolveOutcome));
    assert.deepEqual(unhandled, []);
    assert.equal(fakeProcess.inputErrorListenerCount(), 0);
    assert.equal(fakeProcess.stopCalls, 1);
  } finally {
    globalThis.process.removeListener("unhandledRejection", onUnhandledRejection);
  }
});

test("JSON-RPC client rejects pending requests when stdin emits EPIPE", async () => {
  const fakeProcess = createFakeProcess();
  const client = createJsonRpcClient(fakeProcess, { timeoutMs: 20 });
  const unhandled = [];
  const onUnhandledRejection = (error) => unhandled.push(error);
  globalThis.process.on("unhandledRejection", onUnhandledRejection);

  try {
    fakeProcess.emitStdout("partial stdout");
    fakeProcess.emitStderr("adapter stderr");
    const pending = [
      client.request({ id: "async-epipe-one", method: "scenario.run" }),
      client.request({ id: "async-epipe-two", method: "coverage.report" }),
    ];

    fakeProcess.emitInputError(new Error("async EPIPE"));

    const results = await Promise.allSettled(pending);
    assert.equal(results.length, 2);
    for (const result of results) {
      assert.equal(result.status, "rejected");
      assert.match(result.reason.message, /Command failed: lunatest-mcp --empty/);
      assert.match(result.reason.message, /Unable to write JSON-RPC request: async EPIPE/);
      assert.match(result.reason.message, /stdout:\npartial stdout/);
      assert.match(result.reason.message, /stderr:\nadapter stderr/);
    }
    assert.equal(client.pendingRequestCount(), 0);
    await client.dispose();
    await new Promise((resolveOutcome) => setImmediate(resolveOutcome));
    assert.deepEqual(unhandled, []);
    assert.equal(fakeProcess.inputErrorListenerCount(), 0);
    assert.equal(fakeProcess.stopCalls, 1);
  } finally {
    globalThis.process.removeListener("unhandledRejection", onUnhandledRejection);
  }
});
