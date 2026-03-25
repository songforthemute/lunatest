import {
  createLunaWalletAssetState,
  getLunaWalletTokenAsset,
  normalizeAddress,
  type LunaWalletAssetState,
  type LunaWalletTokenAsset,
} from "@lunatest/contracts";

import type { TokenRuntime } from "../types";

type DemoTokenSeedInput = {
  tokenIn: TokenRuntime;
  tokenOut: TokenRuntime;
};

function toTokenAsset(token: TokenRuntime): LunaWalletTokenAsset {
  return {
    balance: token.balance.toString(),
    allowance: token.allowance.toString(),
    symbol: token.symbol,
    decimals: token.decimals,
  };
}

function fromTokenAsset(
  token: TokenRuntime,
  asset: LunaWalletTokenAsset | null,
): TokenRuntime {
  if (!asset) {
    return token;
  }

  return {
    ...token,
    balance: BigInt(asset.balance),
    allowance: BigInt(asset.allowance),
    symbol: asset.symbol ?? token.symbol,
    decimals: asset.decimals ?? token.decimals,
  };
}

export function createDemoLunaWalletAssets(
  input: DemoTokenSeedInput,
): LunaWalletAssetState {
  const tokenInUnit = 10n ** BigInt(input.tokenIn.decimals);
  const tokenOutUnit = 10n ** BigInt(input.tokenOut.decimals);

  return createLunaWalletAssetState({
    tokens: {
      [normalizeAddress(input.tokenIn.address)]: {
        ...toTokenAsset(input.tokenIn),
        balance: (25n * tokenInUnit).toString(),
        allowance: "0",
      },
      [normalizeAddress(input.tokenOut.address)]: {
        ...toTokenAsset(input.tokenOut),
        balance: (0n * tokenOutUnit).toString(),
        allowance: "0",
      },
    },
  });
}

export function applyLunaWalletAssetState(
  assets: LunaWalletAssetState,
  input: DemoTokenSeedInput,
): { tokenIn: TokenRuntime; tokenOut: TokenRuntime } {
  return {
    tokenIn: fromTokenAsset(input.tokenIn, getLunaWalletTokenAsset(assets, input.tokenIn.address)),
    tokenOut: fromTokenAsset(input.tokenOut, getLunaWalletTokenAsset(assets, input.tokenOut.address)),
  };
}

export function patchLunaWalletAssetState(
  assets: LunaWalletAssetState,
  patches: Record<string, Partial<LunaWalletTokenAsset>>,
): LunaWalletAssetState {
  return createLunaWalletAssetState({
    ...assets,
    tokens: Object.fromEntries(
      Object.entries({
        ...assets.tokens,
        ...Object.fromEntries(
          Object.entries(patches).map(([address, patch]) => [
            normalizeAddress(address),
            {
              ...(assets.tokens[normalizeAddress(address)] ?? {
                balance: "0",
                allowance: "0",
              }),
              ...patch,
            },
          ]),
        ),
      }),
    ),
  });
}
