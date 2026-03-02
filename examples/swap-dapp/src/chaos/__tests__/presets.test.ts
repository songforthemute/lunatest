import { describe, expect, it } from "vitest";

import { DEFAULT_CHAOS_PRESETS, parseChaosPresetsFromLua } from "../presets";

describe("parseChaosPresetsFromLua", () => {
  it("falls back to defaults when presets are missing", async () => {
    const parsed = await parseChaosPresetsFromLua(`
scenario {
  name = "only_root",
  mode = "permissive",
  given = {},
}
`);

    expect(parsed).toEqual(DEFAULT_CHAOS_PRESETS);
  });

  it("extracts presets from lua table", async () => {
    const parsed = await parseChaosPresetsFromLua(`
scenario {
  name = "with_presets",
  mode = "permissive",
  given = {},
  presets = {
    high_slippage_80 = {
      label = "Slippage 80%",
      description = "desc",
      lua = [[scenario { name = "high_slippage_80", mode = "permissive", given = {} }]],
      routeMocks = {
        { endpointType = "ethereum", method = "eth_call", responseKey = "call.mock" },
      },
      statePatch = {
        chaos = { slippagePctOverride = 80 },
      },
    },
  },
}
`);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.id).toBe("high_slippage_80");
    expect(parsed[0]?.label).toBe("Slippage 80%");
    expect(parsed[0]?.routeMocks[0]).toEqual({
      endpointType: "ethereum",
      method: "eth_call",
      responseKey: "call.mock",
    });
  });
});
