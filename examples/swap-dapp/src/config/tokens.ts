import type { SwapEnvConfig } from "./network";

export type TokenSeed = {
  address: `0x${string}`;
};

export type TokenPairSeed = {
  tokenIn: TokenSeed;
  tokenOut: TokenSeed;
};

export function toTokenPairSeed(config: SwapEnvConfig): TokenPairSeed {
  return {
    tokenIn: { address: config.tokenIn },
    tokenOut: { address: config.tokenOut },
  };
}
