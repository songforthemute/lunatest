import { describe, expect, it } from "vitest";

import { createProviderOptionsKey } from "../provider-options";

describe("provider options key", () => {
  it("stays stable for equivalent nested option objects", () => {
    const left = createProviderOptionsKey({
      chainId: "0x1",
      accounts: ["0x1"],
      balances: {
        "0x1": "0x10",
      },
      wallet: {
        connected: true,
        chainId: "0x1",
      },
    });

    const right = createProviderOptionsKey({
      wallet: {
        chainId: "0x1",
        connected: true,
      },
      balances: {
        "0x1": "0x10",
      },
      accounts: ["0x1"],
      chainId: "0x1",
    });

    expect(left).toBe(right);
  });
});
