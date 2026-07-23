import { describe, expect, it } from "vitest";

import {
  createDeterministicScenarioAdapter,
  executeLuaScenario,
} from "../execute-scenario.js";
import { createScenarioRuntime } from "../../runtime/scenario-runtime.js";

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

  it("applies routes, given state, and intercept state before resolving deterministic assertions", async () => {
    const source = `scenario {
      name = "deterministic-intercept",
      given = { wallet = { connected = true } },
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
      given: { wallet: { connected: true } },
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
