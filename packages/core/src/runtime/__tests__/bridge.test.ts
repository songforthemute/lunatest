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

  it("preserves __proto__ as data key", () => {
    const input = JSON.parse(`{"__proto__":""}`) as Record<string, unknown>;

    const roundTrip = fromLuaValue(toLuaArgs(input)) as Record<string, unknown>;

    expect(Object.prototype.hasOwnProperty.call(roundTrip, "__proto__")).toBe(true);
    expect(roundTrip.__proto__).toBe("");
  });
});
