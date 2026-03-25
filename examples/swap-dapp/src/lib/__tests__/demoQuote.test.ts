import { describe, expect, it } from "vitest";

import { createDemoQuote } from "../demoQuote";

describe("createDemoQuote", () => {
  it("returns a deterministic fallback quote", () => {
    const result = createDemoQuote({
      amountIn: 10n ** 17n,
      inputDecimals: 18,
      outputDecimals: 6,
    });

    expect(result.amountOut).toBeGreaterThan(0n);
    expect(result.gasEstimate).toBe(165000n);
    expect(result.priceImpactPct).toBe(0.7);
  });
});
