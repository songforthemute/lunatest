import { describe, expect, it } from "vitest";

import { LunaProvider } from "../luna-provider";

describe("LunaProvider EIP-1193 contract", () => {
  it("supports eth_chainId", async () => {
    const provider = new LunaProvider({ chainId: "0x1" });

    await expect(provider.request({ method: "eth_chainId" })).resolves.toBe("0x1");
  });

  it("supports eth_accounts", async () => {
    const provider = new LunaProvider({
      accounts: ["0xabc"],
    });

    await expect(provider.request({ method: "eth_accounts" })).resolves.toEqual([
      "0xabc",
    ]);
  });

  it("supports eth_getBalance", async () => {
    const provider = new LunaProvider({
      accounts: ["0xabc"],
      balances: {
        "0xabc": "0x1",
      },
    });

    await expect(
      provider.request({ method: "eth_getBalance", params: ["0xabc"] }),
    ).resolves.toBe("0x1");
  });

  it("supports eth_call", async () => {
    const provider = new LunaProvider({
      callHandler: async ({ to }) => `0xcall-${String(to)}`,
    });

    await expect(
      provider.request({
        method: "eth_call",
        params: [{ to: "0xcontract", data: "0x" }, "latest"],
      }),
    ).resolves.toBe("0xcall-0xcontract");
  });

  it("supports eth_sendTransaction and eth_getTransactionReceipt", async () => {
    const provider = new LunaProvider({});

    const txHash = await provider.request({
      method: "eth_sendTransaction",
      params: [{ from: "0xabc", to: "0xdef", value: "0x1" }],
    });

    expect(typeof txHash).toBe("string");

    await expect(
      provider.request({ method: "eth_getTransactionReceipt", params: [txHash] }),
    ).resolves.toMatchObject({
      transactionHash: txHash,
      status: "0x1",
    });
  });

  it("supports wallet_switchEthereumChain", async () => {
    const provider = new LunaProvider({ chainId: "0x1" });

    await expect(
      provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xa" }],
      }),
    ).resolves.toBeNull();

    await expect(provider.request({ method: "eth_chainId" })).resolves.toBe("0xa");
  });

  it("supports eth_subscribe", async () => {
    const provider = new LunaProvider({});

    await expect(
      provider.request({ method: "eth_subscribe", params: ["newHeads"] }),
    ).resolves.toMatch(/^0xsub/);
  });

  it("throws for unsupported method", async () => {
    const provider = new LunaProvider({});

    await expect(provider.request({ method: "eth_blockNumber" })).rejects.toThrow(
      /Unsupported method/,
    );
  });
});
