import { Contract, formatUnits, type BrowserProvider } from "ethers";
import { UNISWAP_QUOTER_V2_ABI } from "../config/uniswap";
import type { QuoteResult } from "../types";

type QuoteInput = {
  quoterAddress: string;
  tokenIn: string;
  tokenOut: string;
  fee: number;
  amountIn: bigint;
  outputDecimals: number;
};

type QuoteCallOutput = {
  amountOut: bigint;
  sqrtPriceX96After: bigint;
  initializedTicksCrossed: number;
  gasEstimate: bigint;
};

function normalizeQuoteOutput(raw: unknown): QuoteCallOutput {
  if (Array.isArray(raw)) {
    return {
      amountOut: BigInt(raw[0] as bigint),
      sqrtPriceX96After: BigInt(raw[1] as bigint),
      initializedTicksCrossed: Number(raw[2] as number),
      gasEstimate: BigInt(raw[3] as bigint),
    };
  }

  const record = raw as {
    amountOut: bigint;
    sqrtPriceX96After: bigint;
    initializedTicksCrossed: number;
    gasEstimate: bigint;
  };

  return {
    amountOut: BigInt(record.amountOut),
    sqrtPriceX96After: BigInt(record.sqrtPriceX96After),
    initializedTicksCrossed: Number(record.initializedTicksCrossed),
    gasEstimate: BigInt(record.gasEstimate),
  };
}

function calculatePriceImpact(
  amountIn: bigint,
  amountOut: bigint,
  refIn: bigint,
  refOut: bigint,
): number {
  if (amountIn <= 0n || amountOut <= 0n || refIn <= 0n || refOut <= 0n) {
    return 0;
  }

  const linearOut = (refOut * amountIn) / refIn;
  if (linearOut <= 0n || linearOut <= amountOut) {
    return 0;
  }

  const diff = Number(linearOut - amountOut);
  const baseline = Number(linearOut);
  if (!Number.isFinite(diff) || !Number.isFinite(baseline) || baseline === 0) {
    return 0;
  }

  return (diff / baseline) * 100;
}

export async function quoteExactInputSingle(
  provider: BrowserProvider,
  input: QuoteInput,
): Promise<QuoteResult> {
  const quoter = new Contract(input.quoterAddress, UNISWAP_QUOTER_V2_ABI, provider);

  const outputRaw = await quoter.quoteExactInputSingle.staticCall({
    tokenIn: input.tokenIn,
    tokenOut: input.tokenOut,
    amountIn: input.amountIn,
    fee: input.fee,
    sqrtPriceLimitX96: 0n,
  });

  const output = normalizeQuoteOutput(outputRaw);
  let priceImpactPct = 0;

  const refIn = input.amountIn > 10n ** 18n ? 10n ** 18n : input.amountIn;
  if (refIn > 0n && refIn !== input.amountIn) {
    const refRaw = await quoter.quoteExactInputSingle.staticCall({
      tokenIn: input.tokenIn,
      tokenOut: input.tokenOut,
      amountIn: refIn,
      fee: input.fee,
      sqrtPriceLimitX96: 0n,
    });

    const refOut = normalizeQuoteOutput(refRaw);
    priceImpactPct = calculatePriceImpact(input.amountIn, output.amountOut, refIn, refOut.amountOut);
  }

  return {
    amountOut: output.amountOut,
    amountOutFormatted: formatUnits(output.amountOut, input.outputDecimals),
    gasEstimate: output.gasEstimate,
    gasEstimateFormatted: output.gasEstimate.toString(),
    priceImpactPct,
  };
}
