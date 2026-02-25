import { describe, expect, it } from "vitest";

import { generate } from "../generation/combinatorial";
import { mutateScenarioVariants } from "../generation/mutator";

describe("mcp generation", () => {
  it("builds combinational cases in deterministic order", () => {
    const result = generate(
      {
        amount: [1, 10],
        slippage: [0.5, 1],
      },
      10,
    );

    expect(result).toEqual([
      { amount: 1, slippage: 0.5 },
      { amount: 1, slippage: 1 },
      { amount: 10, slippage: 0.5 },
      { amount: 10, slippage: 1 },
    ]);
  });

  it("creates mutated scenario variants", () => {
    const variants = mutateScenarioVariants(
      {
        id: "swap-1",
        name: "swap happy path",
        lua: "scenario = { given = { amount = 10 }, stages = { { name = 'a' } } }",
      },
      2,
    );

    expect(variants).toHaveLength(2);
    expect(variants[0]).toMatchObject({
      id: "swap-1-mut-1",
      name: "swap happy path mutation 1",
    });
    expect(variants[0]?.lua).toContain("mutation 1");
    expect(variants[1]?.lua).toContain("mutation 2");
  });
});
