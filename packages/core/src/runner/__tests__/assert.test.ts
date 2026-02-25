import { describe, expect, it } from "vitest";

import { assertUI } from "../assert";

describe("assertion engine", () => {
  it("returns pass=true when values match", () => {
    const result = assertUI(
      { button: { disabled: true } },
      { button: { disabled: true } },
    );

    expect(result.pass).toBe(true);
    expect(result.diff).toBe("");
  });

  it("prints diff on mismatch", () => {
    const result = assertUI(
      { button: { disabled: true } },
      { button: { disabled: false } },
    );

    expect(result.pass).toBe(false);
    expect(result.diff).toContain("expected");
    expect(result.diff).toContain("disabled");
  });
});
