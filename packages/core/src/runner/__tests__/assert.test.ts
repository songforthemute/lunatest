import { describe, expect, it } from "vitest";

import {
  assertNot,
  assertState,
  assertTiming,
  assertTransition,
  assertUI,
} from "../assert";

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

  it("supports state assertion", () => {
    const result = assertState({ stage: "complete" }, { stage: "complete" });
    expect(result.pass).toBe(true);
  });

  it("supports transition assertion", () => {
    const result = assertTransition(
      ["need_approval", "approve_pending", "complete"],
      ["need_approval", "approve_pending", "complete"],
    );
    expect(result.pass).toBe(true);
  });

  it("supports negative assertion", () => {
    const result = assertNot(["error_modal"], {
      warning: true,
      button: {
        disabled: false,
      },
    });
    expect(result.pass).toBe(true);
  });

  it("supports timing assertion", () => {
    const pass = assertTiming(3000, 2800);
    const fail = assertTiming(3000, 3200);

    expect(pass.pass).toBe(true);
    expect(fail.pass).toBe(false);
  });
});
