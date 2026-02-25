import { describe, expect, it } from "vitest";

import { LunaProvider } from "@lunatest/core";

import { withLunaWagmiConfig } from "../adapters/wagmi";

describe("wagmi adapter", () => {
  it("injects luna transport into wagmi-like config", async () => {
    const provider = new LunaProvider({ chainId: "0x1" });
    const config = withLunaWagmiConfig(
      {
        chains: [{ id: 1 }],
      },
      provider,
    );

    const transport = config.transports?.[1];
    expect(transport).toBeDefined();
    await expect(
      transport?.request({
        method: "eth_chainId",
      }),
    ).resolves.toBe("0x1");
  });
});
