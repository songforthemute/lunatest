import { describe, expect, it } from "vitest";

import { createMockProvider } from "../provider";

describe("mock provider", () => {
  it("returns injected wallet balance", async () => {
    const provider = await createMockProvider({
      wallet: {
        address: "0xabc",
        balances: {
          ETH: "10",
        },
      },
    });

    await expect(
      provider.request({ method: "eth_getBalance", params: ["0xabc"] }),
    ).resolves.toBe("0x8ac7230489e80000");
  });

  it("throws for unsupported method", async () => {
    const provider = await createMockProvider({
      wallet: {
        address: "0xabc",
        balances: {
          ETH: "1",
        },
      },
    });

    await expect(provider.request({ method: "eth_blockNumber" })).rejects.toThrow(
      /Unsupported method/,
    );
  });
});
