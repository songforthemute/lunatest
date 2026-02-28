import { describe, expect, it } from "vitest";

import { measureScenarioPerformance } from "../../runner/performance";

describe("performance", () => {
  it("runs 1000 scenarios under 1 second", async () => {
    const result = await measureScenarioPerformance({
      iterations: 1000,
      scenario: {
        name: "perf-swap",
        given: {},
        when: { action: "swap" },
        then_ui: { warning: false },
      },
      resolveUi: async () => ({ warning: false }),
    });

    expect(result.totalMs).toBeLessThan(1000);
  });

  it("keeps single scenario p95 under 1ms in sample", async () => {
    const result = await measureScenarioPerformance({
      iterations: 200,
      scenario: {
        name: "single-swap",
        given: {},
        when: { action: "swap" },
        then_ui: { warning: false },
      },
      resolveUi: async () => ({ warning: false }),
    });

    expect(result.p95Ms).toBeLessThan(1);
  });
});
