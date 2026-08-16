import type { Config } from "@wagmi/core";
import { useMemo, useSyncExternalStore } from "react";

import { createSwapJourney } from "./journey";

export function App({ config }: { config: Config }) {
  const journey = useMemo(() => createSwapJourney(config), [config]);
  const snapshot = useSyncExternalStore(
    journey.subscribe,
    journey.getSnapshot,
    journey.getSnapshot,
  );
  const { account, approvalHash, error, history, portfolio, quote, stage, swapHash } = snapshot;

  return (
    <main>
      <p className="eyebrow">Packed external consumer proof</p>
      <h1>Deterministic swap journey</h1>
      <p>
        This app uses its normal wagmi Core contract actions while LunaTest owns
        the wallet and protocol boundary.
      </p>

      <section className="actions" aria-label="Swap journey actions">
        <button disabled={stage !== "disconnected"} onClick={journey.connectWallet}>
          Connect wallet
        </button>
        <button disabled={stage !== "wallet_connected"} onClick={journey.requestQuote}>
          Get quote
        </button>
        <button disabled={stage !== "approval_required"} onClick={journey.approveToken}>
          Approve token
        </button>
        <button disabled={stage !== "ready_to_swap"} onClick={journey.swapToken}>
          Swap token
        </button>
      </section>

      <dl>
        <div><dt>Stage</dt><dd data-testid="stage">{stage}</dd></div>
        <div><dt>Account</dt><dd data-testid="account">{account ?? "not connected"}</dd></div>
        <div><dt>Quote</dt><dd data-testid="quote">{quote?.toString() ?? "—"}</dd></div>
        <div><dt>Allowance</dt><dd data-testid="allowance">{portfolio.allowance.toString()}</dd></div>
        <div><dt>Input balance</dt><dd data-testid="input-balance">{portfolio.inputBalance.toString()}</dd></div>
        <div><dt>Output balance</dt><dd data-testid="output-balance">{portfolio.outputBalance.toString()}</dd></div>
      </dl>

      <p className="receipt" data-testid="approval-hash">
        Approval: {approvalHash ?? "not submitted"}
      </p>
      <p className="receipt" data-testid="swap-hash">
        Swap: {swapHash ?? "not submitted"}
      </p>
      <ol data-testid="transition-history">
        {history.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
      </ol>
      {error ? <pre role="alert">{error}</pre> : null}
    </main>
  );
}
