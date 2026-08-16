import type { Config } from "@wagmi/core";
import type { Address, Hash } from "viem";

import {
  approveSwap,
  connectWallet,
  readPortfolio,
  readQuote,
  submitSwap,
  type Portfolio,
} from "./swap";

export type JourneyStage =
  | "disconnected"
  | "wallet_connected"
  | "quote_ready"
  | "approval_required"
  | "approval_pending"
  | "ready_to_swap"
  | "swap_pending"
  | "swap_confirmed"
  | "error";

export type JourneySnapshot = {
  account?: Address;
  approvalHash?: Hash;
  error: string;
  history: readonly JourneyStage[];
  portfolio: Portfolio;
  quote?: bigint;
  stage: JourneyStage;
  swapHash?: Hash;
};

export type SwapJourney = {
  approveToken: () => Promise<void>;
  connectWallet: () => Promise<void>;
  getSnapshot: () => JourneySnapshot;
  requestQuote: () => Promise<void>;
  subscribe: (listener: () => void) => () => void;
  swapToken: () => Promise<void>;
};

const initialSnapshot: JourneySnapshot = {
  error: "",
  history: ["disconnected"],
  portfolio: {
    allowance: 0n,
    inputBalance: 0n,
    outputBalance: 0n,
  },
  stage: "disconnected",
};

export function createSwapJourney(config: Config): SwapJourney {
  const listeners = new Set<() => void>();
  let snapshot = initialSnapshot;

  function update(patch: Partial<JourneySnapshot>): void {
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) listener();
  }

  function transition(stage: JourneyStage): void {
    update({ stage, history: [...snapshot.history, stage] });
  }

  function fail(cause: unknown): void {
    update({ error: cause instanceof Error ? cause.message : String(cause) });
    transition("error");
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async connectWallet() {
      try {
        const account = await connectWallet(config);
        update({ account, portfolio: await readPortfolio(config, account) });
        transition("wallet_connected");
      } catch (cause) {
        fail(cause);
      }
    },
    async requestQuote() {
      try {
        update({ quote: await readQuote(config) });
        transition("quote_ready");
        transition("approval_required");
      } catch (cause) {
        fail(cause);
      }
    },
    async approveToken() {
      const { account } = snapshot;
      if (!account) return;
      try {
        transition("approval_pending");
        const approvalHash = await approveSwap(config, account);
        update({ approvalHash, portfolio: await readPortfolio(config, account) });
        transition("ready_to_swap");
      } catch (cause) {
        fail(cause);
      }
    },
    async swapToken() {
      const { account } = snapshot;
      if (!account) return;
      try {
        transition("swap_pending");
        const swapHash = await submitSwap(config, account);
        update({ swapHash, portfolio: await readPortfolio(config, account) });
        transition("swap_confirmed");
      } catch (cause) {
        fail(cause);
      }
    },
  };
}

export function observeJourneyUi(snapshot: JourneySnapshot): Record<string, unknown> {
  return {
    stage: snapshot.stage,
    quote: snapshot.quote?.toString() ?? "—",
    allowance: snapshot.portfolio.allowance.toString(),
    input_balance: snapshot.portfolio.inputBalance.toString(),
    output_balance: snapshot.portfolio.outputBalance.toString(),
    approval_submitted: snapshot.approvalHash !== undefined,
    swap_submitted: snapshot.swapHash !== undefined,
    ...(snapshot.error ? { error: snapshot.error } : {}),
  };
}

export function observeJourneyState(snapshot: JourneySnapshot): Record<string, unknown> {
  return {
    connected: snapshot.account !== undefined,
    stage: snapshot.stage,
    quote: snapshot.quote?.toString() ?? "—",
    allowance: snapshot.portfolio.allowance.toString(),
    input_balance: snapshot.portfolio.inputBalance.toString(),
    output_balance: snapshot.portfolio.outputBalance.toString(),
  };
}
