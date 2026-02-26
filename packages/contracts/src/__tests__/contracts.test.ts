import { describe, expect, it } from "vitest";

import { deepMerge, isRecord } from "../index.js";

describe("contracts utils", () => {
  it("deep merges nested records", () => {
    const merged = deepMerge(
      {
        chain: {
          id: 1,
        },
      },
      {
        chain: {
          gasPrice: 30,
        },
      },
    );

    expect(merged).toEqual({
      chain: {
        id: 1,
        gasPrice: 30,
      },
    });
  });

  it("checks record values", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
  });
});
