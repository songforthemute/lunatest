export type SwapWarnings = {
  highSlippage: boolean;
  gasSpike: boolean;
  wrongNetwork: boolean;
  insufficientBalance: boolean;
  insufficientAllowance: boolean;
};

type WarningInput = {
  chainId: number | null;
  expectedChainId: number;
  amountIn: bigint;
  balance: bigint;
  allowance: bigint;
  priceImpactPct: number;
  slippageOverridePct: number | null;
  gasPriceOverrideGwei: number | null;
  sampledGasPriceGwei: number;
};

export function resolveSwapWarnings(input: WarningInput): SwapWarnings {
  const effectiveSlippage = input.slippageOverridePct ?? input.priceImpactPct;
  const effectiveGas = input.gasPriceOverrideGwei ?? input.sampledGasPriceGwei;

  return {
    highSlippage: effectiveSlippage >= 15,
    gasSpike: effectiveGas >= 300,
    wrongNetwork: input.chainId !== input.expectedChainId,
    insufficientBalance: input.amountIn > 0n && input.amountIn > input.balance,
    insufficientAllowance: input.amountIn > 0n && input.amountIn > input.allowance,
  };
}
