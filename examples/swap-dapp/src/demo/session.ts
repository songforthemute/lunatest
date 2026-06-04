import { createLunaWalletSession, type LunaWalletSession } from "@lunatest/contracts";

import { createDemoLunaWalletAssets } from "../lib/lunaWallet";
import { SEPOLIA_CHAIN_ID, type SwapEnvConfig } from "../config/network";
import type { TokenRuntime } from "../types";

export const DETERMINISTIC_DEMO_ACCOUNT = "0x1111111111111111111111111111111111111111";

function makeTokenRuntime(
  address: string,
  symbol: string,
  decimals: number,
): TokenRuntime {
  return {
    address,
    symbol,
    decimals,
    balance: 0n,
    allowance: 0n,
  };
}

export function createDeterministicWalletSession(
  config: SwapEnvConfig,
): LunaWalletSession {
  return createLunaWalletSession({
    enabled: true,
    connected: true,
    chainId: `0x${SEPOLIA_CHAIN_ID.toString(16)}`,
    accounts: [DETERMINISTIC_DEMO_ACCOUNT],
    assets: createDemoLunaWalletAssets({
      tokenIn: makeTokenRuntime(config.tokenIn, "WETH", 18),
      tokenOut: makeTokenRuntime(config.tokenOut, "USDC", 6),
    }),
  });
}
