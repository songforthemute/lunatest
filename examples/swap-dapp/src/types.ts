import type { RouteMock } from "@lunatest/runtime-intercept";

export type SwapViewState =
  | "idle"
  | "wallet_connected"
  | "quote_ready"
  | "approval_required"
  | "approval_pending"
  | "ready_to_swap"
  | "swap_pending"
  | "swap_confirmed"
  | "swap_failed";

export type QuoteResult = {
  amountOut: bigint;
  amountOutFormatted: string;
  gasEstimate: bigint;
  gasEstimateFormatted: string;
  priceImpactPct: number;
};

export type TxProgress = {
  type: "approve" | "swap";
  status: "idle" | "pending" | "confirmed" | "failed";
  hash?: string;
  error?: string;
  submittedAtMs?: number;
  confirmedAtMs?: number;
};

export type ChaosPreset = {
  id: string;
  label: string;
  description: string;
  lua: string;
  routeMocks: RouteMock[];
  statePatch: Record<string, unknown>;
};

export type TokenRuntime = {
  address: string;
  symbol: string;
  decimals: number;
  balance: bigint;
  allowance: bigint;
};
