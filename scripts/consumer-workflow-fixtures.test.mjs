import assert from "node:assert/strict";
import test from "node:test";

import { createConsumerWorkflowFixture } from "./consumer-workflow-fixtures.mjs";
import { createJsonRpcClient } from "./smoke-helpers.mjs";

function createFakeProcess() {
  const stdoutListeners = new Set();
  let stdout = "";
  let stderr = "";

  return {
    command: "lunatest-mcp",
    args: ["--empty"],
    writes: [],
    closeInputCalls: 0,
    stopCalls: 0,
    onStdout(listener) {
      stdoutListeners.add(listener);
      return () => stdoutListeners.delete(listener);
    },
    write(input) {
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
    async waitForExit() {
      return { code: 0, signal: null };
    },
    async stop() {
      this.stopCalls += 1;
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
  assert.equal(process.stopCalls, 1);
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
