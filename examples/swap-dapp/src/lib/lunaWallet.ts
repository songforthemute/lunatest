import type { TokenRuntime } from "../types";

type DemoTokenSeedInput = {
  tokenIn: TokenRuntime;
  tokenOut: TokenRuntime;
};

export function seedLunaWalletTokenState(
  input: DemoTokenSeedInput,
): { tokenIn: TokenRuntime; tokenOut: TokenRuntime } {
  const tokenInUnit = 10n ** BigInt(input.tokenIn.decimals);
  const tokenOutUnit = 10n ** BigInt(input.tokenOut.decimals);

  return {
    tokenIn: {
      ...input.tokenIn,
      balance: 25n * tokenInUnit,
      allowance: 0n,
    },
    tokenOut: {
      ...input.tokenOut,
      balance: 0n * tokenOutUnit,
      allowance: 0n,
    },
  };
}
