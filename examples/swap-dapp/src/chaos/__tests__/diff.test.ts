import { describe, expect, it } from "vitest";

import { diffState } from "../diff";

describe("diffState", () => {
  it("returns changed leaf paths", () => {
    const result = diffState(
      {
        chain: { gasPriceGwei: 30 },
        chaos: { preset: "none" },
      },
      {
        chain: { gasPriceGwei: 500 },
        chaos: { preset: "gas_spike_500_gwei" },
      },
    );

    expect(result).toEqual(
      expect.arrayContaining([
        "chain.gasPriceGwei: 30 -> 500",
        'chaos.preset: "none" -> "gas_spike_500_gwei"',
      ]),
    );
  });
});
