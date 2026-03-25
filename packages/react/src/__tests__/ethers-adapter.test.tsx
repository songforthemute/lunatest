import { describe, expect, it } from "vitest";

import { LunaProvider } from "@lunatest/core";

import { createEthersAdapter } from "../adapters/ethers";

describe("ethers adapter", () => {
  it("forwards send calls to luna provider", async () => {
    const provider = new LunaProvider({ chainId: "0x1" });
    const adapter = createEthersAdapter(provider);

    await expect(adapter.send("eth_chainId")).resolves.toBe("0x1");
  });
});
