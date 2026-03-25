import { describe, expect, it } from "vitest";

import { toLunaPass } from "../matchers";
import { createLunaVitestPlugin } from "../plugin";

describe("vitest plugin", () => {
  it("creates plugin with default scenario dir", () => {
    const plugin = createLunaVitestPlugin();
    expect(plugin.name).toBe("lunatest-vitest-plugin");
    expect(plugin.scenarioDir).toBe("scenarios");
  });

  it("provides toLunaPass matcher", () => {
    expect(toLunaPass({ pass: true }).pass).toBe(true);
    expect(toLunaPass({ pass: false }).pass).toBe(false);
  });
});
