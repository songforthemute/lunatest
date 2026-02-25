import { describe, expect, it } from "vitest";

import { fromLuaValue, toLuaArgs } from "../bridge";

describe("bridge", () => {
  it("preserves nested object round-trip", () => {
    const input = {
      wallet: {
        connected: true,
        balance: 1.5,
      },
      tokens: ["ETH", "USDC"],
    };

    const luaReady = toLuaArgs(input);
    const roundTrip = fromLuaValue(luaReady);

    expect(roundTrip).toEqual(input);
  });

  it("rejects unsupported values", () => {
    expect(() => toLuaArgs({ fn: () => 1 })).toThrow(/Unsupported value type/);
  });
});
