import { describe, expect, it, vi } from "vitest";

import { LunaProvider } from "../luna-provider";

describe("LunaProvider events", () => {
  it("implements on/removeListener for chainChanged", async () => {
    const provider = new LunaProvider({ chainId: "0x1" });
    const listener = vi.fn();

    provider.on("chainChanged", listener);
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0xa" }],
    });

    expect(listener).toHaveBeenCalledWith("0xa");

    provider.removeListener("chainChanged", listener);
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x1" }],
    });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("emits message on tx submit", async () => {
    const provider = new LunaProvider({});
    const listener = vi.fn();
    provider.on("message", listener);

    const txHash = await provider.request({
      method: "eth_sendTransaction",
      params: [{ from: "0xabc", to: "0xdef", value: "0x1" }],
    });

    expect(listener).toHaveBeenCalledWith({
      type: "tx_submitted",
      data: { transactionHash: txHash },
    });
  });
});
