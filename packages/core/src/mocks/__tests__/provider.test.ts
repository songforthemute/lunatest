import { describe, expect, it } from "vitest";

import { createMockProvider } from "../provider";

describe("mock provider", () => {
  it("returns injected wallet balance", async () => {
    const provider = await createMockProvider({
      chain: { id: "0x1" },
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

    await expect(provider.request({ method: "eth_chainId" })).resolves.toBe("0x1");
  });

  it("handles wallet state transition and chain switch", async () => {
    const provider = await createMockProvider({
      wallet: {
        address: "0xabc",
        connected: true,
        balances: {
          ETH: "1",
        },
      },
    });

    await expect(provider.request({ method: "eth_accounts" })).resolves.toEqual([
      "0xabc",
    ]);

    provider.disconnect();
    await expect(provider.request({ method: "eth_accounts" })).resolves.toEqual([]);

    provider.connect("0xdef");
    await expect(provider.request({ method: "eth_accounts" })).resolves.toEqual([
      "0xdef",
    ]);

    provider.approve("USDC", "1000");
    expect(provider.getState().wallet.allowances.USDC).toBe("1000");

    await expect(
      provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xa" }],
      }),
    ).resolves.toBeNull();
    await expect(provider.request({ method: "eth_chainId" })).resolves.toBe("0xa");
  });

  it("advances event queue and confirms tx deterministically", async () => {
    const provider = await createMockProvider({
      wallet: {
        address: "0xabc",
        balances: {
          ETH: "1",
        },
      },
    });

    const txHash = await provider.request({
      method: "eth_sendTransaction",
      params: [{ from: "0xabc", to: "0xdef", value: "0x1" }],
    });

    expect(typeof txHash).toBe("string");

    await expect(
      provider.request({ method: "eth_getTransactionReceipt", params: [txHash] }),
    ).resolves.toBeNull();

    provider.advanceTime(3000);

    await expect(
      provider.request({ method: "eth_getTransactionReceipt", params: [txHash] }),
    ).resolves.toMatchObject({
      transactionHash: txHash,
      status: "0x1",
    });
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
