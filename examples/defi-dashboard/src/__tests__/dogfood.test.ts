import { describe, expect, it } from "vitest";

import {
  createDefiDashboardSnapshot,
  formatBaseUnit,
  formatHealthFactor,
} from "../dogfood";

describe("DeFi dashboard protocol dogfood", () => {
  it("runs built-in protocol presets through public runtime APIs", async () => {
    const snapshot = await createDefiDashboardSnapshot();

    expect(snapshot.wallet.account).toBe("0x1111111111111111111111111111111111111111");
    expect(snapshot.protocols.map((protocol) => protocol.id)).toEqual([
      "uniswap_v2",
      "uniswap_v3",
      "curve",
      "aave",
    ]);
    expect(snapshot.protocols.every((protocol) => protocol.supportLevel === "L3")).toBe(true);
    expect(snapshot.protocols.every((protocol) => protocol.receiptStatus === "0x1")).toBe(true);
    expect(snapshot.protocols.find((protocol) => protocol.id === "aave")?.healthFactor).toBe("2.00");
    expect(snapshot.protocols.find((protocol) => protocol.id === "curve")?.quoteOut).toBe("999");
    expect(snapshot.protocols.find((protocol) => protocol.id === "uniswap_v2")?.quoteOut).toBe("1800");
    expect(snapshot.protocols.find((protocol) => protocol.id === "uniswap_v3")?.quoteOut).toBe("1800");
  });

  it("shares an in-flight snapshot run for singleton runtime safety", async () => {
    const first = createDefiDashboardSnapshot();
    const second = createDefiDashboardSnapshot();
    const results = await Promise.allSettled([first, second]);

    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
    expect(second).toBe(first);
  });

  it("formats deterministic base-unit values for dashboard display", () => {
    expect(formatBaseUnit("1000000", 6)).toBe("1.00");
    expect(formatBaseUnit("25000000000000000000", 18)).toBe("25.00");
    expect(formatHealthFactor("2000000000000000000")).toBe("2.00");
  });
});
