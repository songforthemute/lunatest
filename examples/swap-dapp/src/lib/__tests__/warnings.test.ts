import { describe, expect, it } from "vitest";

import { resolveSwapWarnings } from "../warnings";

describe("resolveSwapWarnings", () => {
  it("flags wrong network", () => {
    const result = resolveSwapWarnings({
      chainId: 1,
      expectedChainId: 11155111,
      amountIn: 0n,
      balance: 0n,
      allowance: 0n,
      priceImpactPct: 0,
      slippageOverridePct: null,
      gasPriceOverrideGwei: null,
      sampledGasPriceGwei: 20,
    });

    expect(result.wrongNetwork).toBe(true);
  });

  it("uses slippage override first", () => {
    const result = resolveSwapWarnings({
      chainId: 11155111,
      expectedChainId: 11155111,
      amountIn: 1n,
      balance: 10n,
      allowance: 10n,
      priceImpactPct: 1,
      slippageOverridePct: 80,
      gasPriceOverrideGwei: null,
      sampledGasPriceGwei: 20,
    });

    expect(result.highSlippage).toBe(true);
  });

  it("uses gas override first", () => {
    const result = resolveSwapWarnings({
      chainId: 11155111,
      expectedChainId: 11155111,
      amountIn: 1n,
      balance: 10n,
      allowance: 10n,
      priceImpactPct: 1,
      slippageOverridePct: null,
      gasPriceOverrideGwei: 500,
      sampledGasPriceGwei: 20,
    });

    expect(result.gasSpike).toBe(true);
  });

  it("flags insufficient balance and allowance", () => {
    const result = resolveSwapWarnings({
      chainId: 11155111,
      expectedChainId: 11155111,
      amountIn: 11n,
      balance: 10n,
      allowance: 5n,
      priceImpactPct: 0,
      slippageOverridePct: null,
      gasPriceOverrideGwei: null,
      sampledGasPriceGwei: 20,
    });

    expect(result.insufficientBalance).toBe(true);
    expect(result.insufficientAllowance).toBe(true);
  });
});
