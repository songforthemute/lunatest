import { describe, expect, it } from "vitest";

import {
  createDeterministicScenarioAdapter,
  executeLuaScenario,
} from "../execute-scenario.js";
import { createScenarioRuntime } from "../../runtime/scenario-runtime.js";

const documentedMultiStageScenario = `scenario {
  name = "approve-then-swap",
  given = {},
  when = { action = "swap" },
  then_ui = { finalScreen = "success" },
  stages = {
    { name = "approval_required", on = "approve" },
    { name = "swap_confirmed", on = "receipt" }
  },
  not_present = { "errorModal" },
  timing_ms = 120
}`;

describe("executeLuaScenario", () => {
  it("returns explicit failure when adapter is missing", async () => {
    const result = await executeLuaScenario({
      source: `scenario {
        name = "missing-adapter",
        given = {},
        when = { action = "swap" },
        then_ui = { warning = true }
      }`,
    });

    expect(result.pass).toBe(false);
    expect(result.error).toBe("executor_not_configured");
  });

  it("returns assertion result from runner", async () => {
    const pass = await executeLuaScenario({
      source: `scenario {
        name = "success",
        given = {},
        when = { action = "swap" },
        then_ui = { warning = true }
      }`,
      adapter: {
        resolveUi: async () => ({ warning: true }),
      },
    });

    expect(pass.pass).toBe(true);

    const fail = await executeLuaScenario({
      source: `scenario {
        name = "failure",
        given = {},
        when = { action = "swap" },
        then_ui = { warning = true }
      }`,
      adapter: {
        resolveUi: async () => ({ warning: false }),
      },
    });

    expect(fail.pass).toBe(false);
    expect(fail.result?.diff).toContain("warning");
  });

  it("enforces documented multi-stage, absence, and timing assertions", async () => {
    const result = await executeLuaScenario({
      source: documentedMultiStageScenario,
      adapter: {
        resolveUi: async () => ({
          finalScreen: "success",
          errorModal: { visible: true },
        }),
        resolveTransitions: async () => ["approval_required", "quote_ready"],
        resolveElapsedMs: async () => 150,
      },
    });

    expect(result.pass).toBe(false);
    expect(result.result?.assertions.transition?.pass).toBe(false);
    expect(result.result?.assertions.negative?.pass).toBe(false);
    expect(result.result?.assertions.timing?.pass).toBe(false);
    expect(result.result?.diff).toContain("[transition]");
    expect(result.result?.diff).toContain("[negative]");
    expect(result.result?.diff).toContain("[timing]");
  });

  it("passes documented multi-stage, absence, and timing assertions", async () => {
    const result = await executeLuaScenario({
      source: documentedMultiStageScenario,
      adapter: {
        resolveUi: async () => ({ finalScreen: "success" }),
        resolveTransitions: async ({ config }) => {
          expect(config.stages).toEqual([
            { name: "approval_required", on: "approve" },
            { name: "swap_confirmed", on: "receipt" },
          ]);
          return ["approval_required", "swap_confirmed"];
        },
        resolveElapsedMs: async () => 120,
      },
    });

    expect(result.pass).toBe(true);
    expect(result.result?.assertions.transition?.pass).toBe(true);
    expect(result.result?.assertions.negative?.pass).toBe(true);
    expect(result.result?.assertions.timing?.pass).toBe(true);
  });

  it("reports missing transition and timing resolvers for Lua scenarios", async () => {
    const result = await executeLuaScenario({
      source: documentedMultiStageScenario,
      adapter: {
        resolveUi: async () => ({ finalScreen: "success" }),
      },
    });

    expect(result.pass).toBe(false);
    expect(result.result?.assertions.transition).toMatchObject({
      pass: false,
      actual: "missing",
    });
    expect(result.result?.assertions.timing).toMatchObject({
      pass: false,
      actual: "missing",
    });
    expect(result.result?.diff).toContain("transition resolver is required");
    expect(result.result?.diff).toContain("timing resolver is required");
  });

  it("applies routes, then lets intercept state override given state", async () => {
    const source = `scenario {
      name = "deterministic-intercept",
      given = {
        wallet = { connected = true },
        quote = { status = "loading" }
      },
      when = { action = "swap" },
      intercept = {
        routes = {
          { endpointType = "ethereum", method = "eth_chainId", responseKey = "chain-id" }
        },
        state = { quote = { status = "ready" } }
      },
      then_ui = {
        wallet = { connected = true },
        quote = { status = "ready" }
      },
      then_state = {
        wallet = { connected = true },
        quote = { status = "ready" }
      }
    }`;
    const config = {
      name: "deterministic-intercept",
      given: {
        wallet: { connected: true },
        quote: { status: "loading" },
      },
      when: { action: "swap" },
      intercept: {
        routes: [
          { endpointType: "ethereum" as const, method: "eth_chainId", responseKey: "chain-id" },
        ],
        state: { quote: { status: "ready" } },
      },
      then_ui: {
        wallet: { connected: true },
        quote: { status: "ready" },
      },
      then_state: {
        wallet: { connected: true },
        quote: { status: "ready" },
      },
    };
    const runtime = createScenarioRuntime(config);
    const adapter = createDeterministicScenarioAdapter();

    await adapter.runWhen?.({ config, runtime });

    expect(runtime.getRouteMocks()).toEqual(config.intercept.routes);
    expect(runtime.getInterceptState()).toEqual({
      wallet: { connected: true },
      quote: { status: "ready" },
    });

    await expect(executeLuaScenario({ source, adapter })).resolves.toMatchObject({
      scenarioName: "deterministic-intercept",
      pass: true,
    });
  });
});
