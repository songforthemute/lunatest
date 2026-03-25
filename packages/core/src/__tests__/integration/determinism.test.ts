import { describe, expect, it } from "vitest";

import { runScenario } from "../../runner/runner";

describe("determinism", () => {
  it("returns identical results for repeated runs", async () => {
    const runs = await Promise.all(
      Array.from({ length: 100 }, () =>
        runScenario({
          scenario: {
            name: "swap-happy",
            given: {},
            when: { action: "swap" },
            then_ui: { warning: false },
          },
          resolveUi: async () => ({ warning: false }),
        }),
      ),
    );

    const [first, ...rest] = runs;
    for (const current of rest) {
      expect(current).toEqual(first);
    }
  });
});
