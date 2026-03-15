import { describe, expect, it } from "vitest";

import { seedLunaWalletTokenState } from "../lunaWallet";
import { isPlaceholderRpcUrl } from "../wallet";

describe("seedLunaWalletTokenState", () => {
  it("seeds demo balances for the no-wallet flow", () => {
    const seeded = seedLunaWalletTokenState({
      tokenIn: {
        address: "0x1",
        symbol: "WETH",
        decimals: 18,
        balance: 0n,
        allowance: 10n,
      },
      tokenOut: {
        address: "0x2",
        symbol: "USDC",
        decimals: 6,
        balance: 99n,
        allowance: 10n,
      },
    });

    expect(seeded.tokenIn.balance).toBe(25n * 10n ** 18n);
    expect(seeded.tokenIn.allowance).toBe(0n);
    expect(seeded.tokenOut.balance).toBe(0n);
  });

  it("detects placeholder rpc urls", () => {
    expect(isPlaceholderRpcUrl("https://sepolia.infura.io/v3/<key>")).toBe(true);
    expect(isPlaceholderRpcUrl("https://rpc.example")).toBe(false);
  });
});
