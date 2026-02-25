import { describe, expect, it } from "vitest";

import { parseScenario } from "../index";

describe("scenario dsl", () => {
  it("rejects scenario without given", () => {
    expect(() =>
      parseScenario({
        name: "invalid",
        when: { action: "swap" },
        then_ui: { warning: true },
      }),
    ).toThrow("given is required");
  });

  it("parses valid scenario", () => {
    const parsed = parseScenario({
      name: "happy-path",
      given: {
        wallet: { connected: true },
      },
      when: { action: "swap" },
      then_ui: { warning: false },
    });

    expect(parsed.name).toBe("happy-path");
    expect(parsed.when.action).toBe("swap");
  });
});
