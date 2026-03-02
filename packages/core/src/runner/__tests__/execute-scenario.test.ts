import { describe, expect, it } from "vitest";

import { executeLuaScenario } from "../execute-scenario.js";

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
});
