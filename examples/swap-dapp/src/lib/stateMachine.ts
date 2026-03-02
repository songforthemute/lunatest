import type { SwapViewState } from "../types";

type StateInput = {
  walletConnected: boolean;
  hasQuote: boolean;
  requiresApproval: boolean;
  readyToSwap: boolean;
  approvalPending: boolean;
  swapPending: boolean;
  swapFailed: boolean;
  swapConfirmed: boolean;
};

export function resolveSwapViewState(input: StateInput): SwapViewState {
  if (!input.walletConnected) {
    return "idle";
  }

  if (input.swapFailed) {
    return "swap_failed";
  }

  if (input.swapConfirmed) {
    return "swap_confirmed";
  }

  if (input.swapPending) {
    return "swap_pending";
  }

  if (input.approvalPending) {
    return "approval_pending";
  }

  if (!input.hasQuote) {
    return "wallet_connected";
  }

  if (input.requiresApproval) {
    return "approval_required";
  }

  if (!input.readyToSwap) {
    return "quote_ready";
  }

  return "ready_to_swap";
}
