import { useState } from "react";
import type { Address, Hash } from "viem";

import {
  approveSwap,
  connectWallet,
  readPortfolio,
  readQuote,
  submitSwap,
  type Portfolio,
} from "./swap";
import type { JourneyConfig } from "./wagmi";

type Stage =
  | "disconnected"
  | "wallet_connected"
  | "quote_ready"
  | "approval_required"
  | "approval_pending"
  | "ready_to_swap"
  | "swap_pending"
  | "swap_confirmed"
  | "error";

const initialPortfolio: Portfolio = {
  allowance: 0n,
  inputBalance: 0n,
  outputBalance: 0n,
};

export function App({ config }: { config: JourneyConfig }) {
  const [account, setAccount] = useState<Address>();
  const [approvalHash, setApprovalHash] = useState<Hash>();
  const [error, setError] = useState("");
  const [history, setHistory] = useState<Stage[]>(["disconnected"]);
  const [portfolio, setPortfolio] = useState(initialPortfolio);
  const [quote, setQuote] = useState<bigint>();
  const [stage, setStage] = useState<Stage>("disconnected");
  const [swapHash, setSwapHash] = useState<Hash>();

  function transition(next: Stage): void {
    setStage(next);
    setHistory((current) => [...current, next]);
  }

  function fail(cause: unknown): void {
    setError(cause instanceof Error ? cause.message : String(cause));
    transition("error");
  }

  async function handleConnect(): Promise<void> {
    try {
      const connectedAccount = await connectWallet(config);
      setAccount(connectedAccount);
      setPortfolio(await readPortfolio(config, connectedAccount));
      transition("wallet_connected");
    } catch (cause) {
      fail(cause);
    }
  }

  async function handleQuote(): Promise<void> {
    try {
      setQuote(await readQuote(config));
      transition("quote_ready");
      transition("approval_required");
    } catch (cause) {
      fail(cause);
    }
  }

  async function handleApprove(): Promise<void> {
    if (!account) return;
    try {
      transition("approval_pending");
      setApprovalHash(await approveSwap(config, account));
      setPortfolio(await readPortfolio(config, account));
      transition("ready_to_swap");
    } catch (cause) {
      fail(cause);
    }
  }

  async function handleSwap(): Promise<void> {
    if (!account) return;
    try {
      transition("swap_pending");
      setSwapHash(await submitSwap(config, account));
      setPortfolio(await readPortfolio(config, account));
      transition("swap_confirmed");
    } catch (cause) {
      fail(cause);
    }
  }

  return (
    <main>
      <p className="eyebrow">Packed external consumer proof</p>
      <h1>Deterministic swap journey</h1>
      <p>
        This app uses its normal wagmi Core contract actions while LunaTest owns
        the wallet and protocol boundary.
      </p>

      <section className="actions" aria-label="Swap journey actions">
        <button disabled={stage !== "disconnected"} onClick={handleConnect}>
          Connect wallet
        </button>
        <button disabled={stage !== "wallet_connected"} onClick={handleQuote}>
          Get quote
        </button>
        <button disabled={stage !== "approval_required"} onClick={handleApprove}>
          Approve token
        </button>
        <button disabled={stage !== "ready_to_swap"} onClick={handleSwap}>
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
