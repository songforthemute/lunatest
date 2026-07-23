import assert from "node:assert/strict";
import test from "node:test";

import { createConsumerWorkflowFixture } from "./consumer-workflow-fixtures.mjs";
import { correlateJsonRpcResponses, formatCommandFailure } from "./smoke-helpers.mjs";

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

test("JSON-RPC response correlation preserves typed IDs and rejects unknown responses", () => {
  const responses = correlateJsonRpcResponses(
    [{ id: 7 }, { id: "scenario-list" }, { id: null }],
    [
      { id: "scenario-list", result: { scenarios: [] } },
      { id: null, result: { empty: true } },
      { id: 7, result: { pass: true } },
    ],
  );

  assert.deepEqual(responses.get(7), { id: 7, result: { pass: true } });
  assert.deepEqual(responses.get("scenario-list"), {
    id: "scenario-list",
    result: { scenarios: [] },
  });
  assert.deepEqual(responses.get(null), { id: null, result: { empty: true } });
  assert.throws(
    () => correlateJsonRpcResponses([{ id: "known" }], [{ id: "unexpected" }]),
    /Unexpected JSON-RPC response ID: "unexpected"/,
  );
});

test("command timeout errors retain command and captured output context", () => {
  const message = formatCommandFailure({
    command: "pnpm",
    args: ["exec", "lunatest", "watch"],
    reason: "Timed out after 500 ms",
    stdout: "Scenario Summary",
    stderr: "watch warning",
  });

  assert.match(message, /Command failed: pnpm exec lunatest watch/);
  assert.match(message, /Timed out after 500 ms/);
  assert.match(message, /stdout:\nScenario Summary/);
  assert.match(message, /stderr:\nwatch warning/);
});
