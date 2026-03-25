import { describe, expect, it } from "vitest";

import {
  applyLunaWalletAssetState,
  createDemoLunaWalletAssets,
  patchLunaWalletAssetState,
} from "../lunaWallet";
import { isPlaceholderRpcUrl } from "../wallet";

describe("seedLunaWalletTokenState", () => {
  it("seeds demo balances for the no-wallet flow", () => {
    const tokenIn = {
      address: "0x1111111111111111111111111111111111111111",
      symbol: "WETH",
      decimals: 18,
      balance: 0n,
      allowance: 10n,
    };
    const tokenOut = {
      address: "0x2222222222222222222222222222222222222222",
      symbol: "USDC",
      decimals: 6,
      balance: 99n,
      allowance: 10n,
    };

    const assets = createDemoLunaWalletAssets({
      tokenIn,
      tokenOut,
    });

    const seeded = applyLunaWalletAssetState(assets, {
      tokenIn,
      tokenOut,
    });

    expect(seeded.tokenIn.balance).toBe(25n * 10n ** 18n);
    expect(seeded.tokenIn.allowance).toBe(0n);
    expect(seeded.tokenOut.balance).toBe(0n);
  });

  it("patches asset state by token address", () => {
    const assets = patchLunaWalletAssetState(
      createDemoLunaWalletAssets({
        tokenIn: {
          address: "0x1111111111111111111111111111111111111111",
          symbol: "WETH",
          decimals: 18,
          balance: 0n,
          allowance: 0n,
        },
        tokenOut: {
          address: "0x2222222222222222222222222222222222222222",
          symbol: "USDC",
          decimals: 6,
          balance: 0n,
          allowance: 0n,
        },
      }),
      {
        "0x1111111111111111111111111111111111111111": {
          allowance: "999",
        },
      },
    );

    const seeded = applyLunaWalletAssetState(assets, {
      tokenIn: {
        address: "0x1111111111111111111111111111111111111111",
        symbol: "WETH",
        decimals: 18,
        balance: 0n,
        allowance: 0n,
      },
      tokenOut: {
        address: "0x2222222222222222222222222222222222222222",
        symbol: "USDC",
        decimals: 6,
        balance: 0n,
        allowance: 0n,
      },
    });

    expect(seeded.tokenIn.allowance).toBe(999n);
  });

  it("detects placeholder rpc urls", () => {
    expect(isPlaceholderRpcUrl("https://sepolia.infura.io/v3/<key>")).toBe(true);
    expect(isPlaceholderRpcUrl("https://rpc.example")).toBe(false);
  });
});
