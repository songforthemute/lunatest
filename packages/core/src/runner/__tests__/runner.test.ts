import { describe, expect, it } from "vitest";

import { runScenario } from "../runner";

describe("runner", () => {
  it("marks scenario as pass when ui matches", async () => {
    const result = await runScenario({
      scenario: {
        name: "happy-path",
        given: {},
        when: { action: "swap" },
        then_ui: { warning: false },
      },
      resolveUi: async () => ({ warning: false }),
    });

    expect(result.pass).toBe(true);
    expect(result.scenarioName).toBe("happy-path");
  });

  it("marks scenario as fail with diff when ui mismatches", async () => {
    const result = await runScenario({
      scenario: {
        name: "warning-case",
        given: {},
        when: { action: "swap" },
        then_ui: { warning: true },
      },
      resolveUi: async () => ({ warning: false }),
    });

    expect(result.pass).toBe(false);
    expect(result.diff).toContain("expected");
  });
});
