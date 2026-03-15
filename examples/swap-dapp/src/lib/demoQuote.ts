import { formatUnits } from "ethers";

import type { QuoteResult } from "../types";

type DemoQuoteInput = {
  amountIn: bigint;
  inputDecimals: number;
  outputDecimals: number;
};

export function createDemoQuote(input: DemoQuoteInput): QuoteResult {
  const normalizedIn =
    Number(formatUnits(input.amountIn, input.inputDecimals || 18));
  const amountOutFloat = normalizedIn * 1785.42;
  const scaledOut = BigInt(
    Math.max(0, Math.round(amountOutFloat * 10 ** Math.min(input.outputDecimals, 6))),
  ) * 10n ** BigInt(Math.max(0, input.outputDecimals - 6));

  return {
    amountOut: scaledOut,
    amountOutFormatted: formatUnits(scaledOut, input.outputDecimals),
    gasEstimate: 165000n,
    gasEstimateFormatted: "165000",
    priceImpactPct: normalizedIn >= 10 ? 4.8 : normalizedIn >= 1 ? 2.1 : 0.7,
  };
}
