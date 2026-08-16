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

  it("reports the first nested mismatch path and leaf values", () => {
    const result = assertUI(
      { swap: { output_balance: "1801", status: "confirmed" } },
      { swap: { output_balance: "1800", status: "confirmed" } },
    );

    expect(result.pass).toBe(false);
    expect(result.mismatch).toEqual({
      path: "then_ui.swap.output_balance",
      expected: "1801",
      actual: "1800",
    });
    expect(result.diff).toBe(
      'expected then_ui.swap.output_balance to equal "1801" but got "1800"',
    );
  });

  it("reports missing array entries at their indexed path", () => {
    const result = assertTransition(
      ["wallet_connected", "approval_pending", "swap_confirmed"],
      ["wallet_connected", "swap_confirmed"],
    );

    expect(result.mismatch).toEqual({
      path: "stages[1]",
      expected: "approval_pending",
      actual: "swap_confirmed",
    });
  });

  it("preserves array-length mismatches when the extra value is undefined", () => {
    const result = assertTransition(["ready"], ["ready", undefined as unknown as string]);

    expect(result.pass).toBe(false);
    expect(result.mismatch).toEqual({
      path: "stages[1]",
      expected: undefined,
      actual: undefined,
      expectedPresent: false,
      actualPresent: true,
    });
    expect(result.diff).toBe(
      "expected stages[1] to be absent but got present with value undefined",
    );
  });

  it("distinguishes a missing object key from an explicit undefined value", () => {
    const result = assertState({ receipt: undefined }, {});

    expect(result.pass).toBe(false);
    expect(result.mismatch).toEqual({
      path: "then_state.receipt",
      expected: undefined,
      actual: undefined,
      expectedPresent: true,
      actualPresent: false,
    });
    expect(result.diff).toBe(
      "expected then_state.receipt to be present with value undefined but got absent",
    );
  });

  it("does not add a mismatch key to passing assertion results", () => {
    const result = assertUI({ status: "ready" }, { status: "ready" });

    expect(Object.hasOwn(result, "mismatch")).toBe(false);
  });

  it("supports state assertion", () => {
    const result = assertState({ stage: "complete" }, { stage: "complete" });
    expect(result.pass).toBe(true);
  });

  it("treats object key order as equal", () => {
    const result = assertUI(
      { button: { disabled: true, label: "Swap" } },
      { button: { label: "Swap", disabled: true } },
    );

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
