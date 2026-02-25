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
        then_state: { stage: "complete" },
        stages: [{ name: "ready" }, { name: "complete" }],
        not_present: ["error_modal"],
        timing_ms: 3000,
      },
      resolveUi: async () => ({ warning: false }),
      resolveState: async () => ({ stage: "complete" }),
      resolveTransitions: async () => ["ready", "complete"],
      resolveElapsedMs: async () => 2800,
    });

    expect(result.pass).toBe(true);
    expect(result.scenarioName).toBe("happy-path");
    expect(result.assertions.state?.pass).toBe(true);
    expect(result.assertions.transition?.pass).toBe(true);
    expect(result.assertions.negative?.pass).toBe(true);
    expect(result.assertions.timing?.pass).toBe(true);
  });

  it("marks scenario as fail with diff when ui mismatches", async () => {
    const result = await runScenario({
      scenario: {
        name: "warning-case",
        given: {},
        when: { action: "swap" },
        then_ui: { warning: true },
        then_state: { stage: "complete" },
        stages: [{ name: "ready" }, { name: "complete" }],
        not_present: ["warning"],
        timing_ms: 1000,
      },
      resolveUi: async () => ({ warning: false }),
      resolveState: async () => ({ stage: "pending" }),
      resolveTransitions: async () => ["ready", "pending"],
      resolveElapsedMs: async () => 1200,
    });

    expect(result.pass).toBe(false);
    expect(result.diff).toContain("[ui]");
    expect(result.diff).toContain("[state]");
    expect(result.diff).toContain("[transition]");
    expect(result.diff).toContain("[negative]");
    expect(result.diff).toContain("[timing]");
  });
});
