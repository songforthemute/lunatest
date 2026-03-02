import { describe, expect, it } from "vitest";

import { resolveSwapViewState } from "../stateMachine";

function baseInput() {
  return {
    walletConnected: true,
    hasQuote: true,
    requiresApproval: false,
    readyToSwap: true,
    approvalPending: false,
    swapPending: false,
    swapFailed: false,
    swapConfirmed: false,
  };
}

describe("resolveSwapViewState", () => {
  it("returns idle when wallet is not connected", () => {
    expect(
      resolveSwapViewState({
        ...baseInput(),
        walletConnected: false,
      }),
    ).toBe("idle");
  });

  it("returns wallet_connected when quote is missing", () => {
    expect(
      resolveSwapViewState({
        ...baseInput(),
        hasQuote: false,
      }),
    ).toBe("wallet_connected");
  });

  it("returns approval_required when allowance is not enough", () => {
    expect(
      resolveSwapViewState({
        ...baseInput(),
        requiresApproval: true,
        readyToSwap: false,
      }),
    ).toBe("approval_required");
  });

  it("returns quote_ready when quote exists but swap cannot proceed", () => {
    expect(
      resolveSwapViewState({
        ...baseInput(),
        readyToSwap: false,
      }),
    ).toBe("quote_ready");
  });

  it("returns approval_pending during approval", () => {
    expect(
      resolveSwapViewState({
        ...baseInput(),
        approvalPending: true,
        readyToSwap: false,
      }),
    ).toBe("approval_pending");
  });

  it("returns swap_pending during swap", () => {
    expect(
      resolveSwapViewState({
        ...baseInput(),
        swapPending: true,
        readyToSwap: false,
      }),
    ).toBe("swap_pending");
  });

  it("returns swap_confirmed after confirmation", () => {
    expect(
      resolveSwapViewState({
        ...baseInput(),
        swapConfirmed: true,
      }),
    ).toBe("swap_confirmed");
  });

  it("returns swap_failed when failed", () => {
    expect(
      resolveSwapViewState({
        ...baseInput(),
        swapFailed: true,
        readyToSwap: false,
      }),
    ).toBe("swap_failed");
  });

  it("returns ready_to_swap when all guards pass", () => {
    expect(resolveSwapViewState(baseInput())).toBe("ready_to_swap");
  });
});
