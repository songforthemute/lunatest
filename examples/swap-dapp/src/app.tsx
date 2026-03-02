import { useCallback, useEffect, useMemo, useState } from "react";
import { formatUnits, parseUnits } from "ethers";
import { loadLunaConfig } from "@lunatest/core";
import {
  applyInterceptState,
  getInterceptState,
  setRouteMocks,
  type RouteMock,
} from "@lunatest/runtime-intercept";

import { AmountInput } from "./components/AmountInput";
import { ActionButtonRow } from "./components/ActionButtonRow";
import { QuotePanel } from "./components/QuotePanel";
import { TokenPairCard } from "./components/TokenPairCard";
import { TxStepper } from "./components/TxStepper";
import { WarningPanel } from "./components/WarningPanel";
import {
  SEPOLIA_CHAIN_ID,
  loadSwapEnvConfig,
  type SwapEnvConfig,
} from "./config/network";
import { toTokenPairSeed } from "./config/tokens";
import {
  approveMax,
  readAllowance,
  readTokenBalance,
  readTokenDecimals,
  readTokenSymbol,
} from "./lib/erc20Approve";
import { resolveSwapViewState } from "./lib/stateMachine";
import { quoteExactInputSingle } from "./lib/uniswapQuote";
import { submitSwap, waitForReceipt } from "./lib/uniswapSwap";
import { connectWallet, readGasPriceGwei, type ConnectedWallet } from "./lib/wallet";
import { resolveSwapWarnings } from "./lib/warnings";
import {
  DEFAULT_CHAOS_PRESETS,
  extractPresetOverrides,
  loadLuaSource,
  parseChaosPresetsFromLua,
} from "./chaos/presets";
import { diffState } from "./chaos/diff";
import type { ChaosPreset, QuoteResult, TokenRuntime, TxProgress } from "./types";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const DEFAULT_MAX_WAIT_MS = 180_000;
const DEFAULT_POLL_MS = 3_000;

function toEnvRecord(env: ImportMetaEnv): Record<string, string | undefined> {
  return env as unknown as Record<string, string | undefined>;
}

function parseAmount(value: string, decimals: number): bigint {
  const normalized = value.trim();
  if (!normalized) {
    return 0n;
  }

  return parseUnits(normalized, decimals);
}

function formatAmount(value: bigint, decimals: number): string {
  return Number(formatUnits(value, decimals)).toLocaleString(undefined, {
    maximumFractionDigits: 6,
  });
}

function makeTokenRuntime(address: string, symbol = "TOKEN"): TokenRuntime {
  return {
    address,
    symbol,
    decimals: 18,
    balance: 0n,
    allowance: 0n,
  };
}

async function hydrateTokenRuntime(
  provider: ConnectedWallet["provider"],
  address: string,
  owner: string,
  spender: string,
  fallbackSymbol: string,
): Promise<TokenRuntime> {
  const [symbol, decimals, balance, allowance] = await Promise.all([
    readTokenSymbol(provider, address),
    readTokenDecimals(provider, address),
    readTokenBalance(provider, address, owner),
    readAllowance(provider, address, owner, spender),
  ]);

  return {
    address,
    symbol: symbol || fallbackSymbol,
    decimals,
    balance,
    allowance,
  };
}

function readInterceptStateSafe(): Record<string, unknown> {
  try {
    return getInterceptState();
  } catch {
    return {};
  }
}

export function App() {
  const envResult = useMemo(() => loadSwapEnvConfig(toEnvRecord(import.meta.env)), []);
  const config = envResult.ok ? envResult.value : null;

  const [wallet, setWallet] = useState<ConnectedWallet | null>(null);
  const [tokenInState, setTokenInState] = useState<TokenRuntime>(() =>
    makeTokenRuntime(config?.tokenIn ?? ZERO_ADDRESS, "TOKEN_IN"),
  );
  const [tokenOutState, setTokenOutState] = useState<TokenRuntime>(() =>
    makeTokenRuntime(config?.tokenOut ?? ZERO_ADDRESS, "TOKEN_OUT"),
  );
  const [amountInput, setAmountInput] = useState("0.1");
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [gasPriceGwei, setGasPriceGwei] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);
  const [approvalTx, setApprovalTx] = useState<TxProgress>({ type: "approve", status: "idle" });
  const [swapTx, setSwapTx] = useState<TxProgress>({ type: "swap", status: "idle" });

  const [luaSource, setLuaSource] = useState("");
  const [luaError, setLuaError] = useState<string | null>(null);
  const [luaMessage, setLuaMessage] = useState<string | null>(null);
  const [chaosPresets, setChaosPresets] = useState<ChaosPreset[]>(DEFAULT_CHAOS_PRESETS);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(DEFAULT_CHAOS_PRESETS[0].id);
  const [chaosState, setChaosState] = useState<Record<string, unknown>>({});
  const [stateDiff, setStateDiff] = useState<string[]>([]);

  useEffect(() => {
    if (!config) {
      return;
    }

    const pair = toTokenPairSeed(config);
    setTokenInState((prev) => makeTokenRuntime(pair.tokenIn.address, prev.symbol));
    setTokenOutState((prev) => makeTokenRuntime(pair.tokenOut.address, prev.symbol));
  }, [config]);

  useEffect(() => {
    let cancelled = false;

    async function bootLua(): Promise<void> {
      try {
        const source = await loadLuaSource("./lunatest.lua");
        if (cancelled) {
          return;
        }
        setLuaSource(source);

        const presets = await parseChaosPresetsFromLua(source);
        if (cancelled) {
          return;
        }
        setChaosPresets(presets);
        setSelectedPresetId((current) => current || presets[0]?.id || "");
      } catch (error) {
        if (cancelled) {
          return;
        }
        setLuaError(error instanceof Error ? error.message : "Failed to load lunatest.lua");
      }

      if (!cancelled) {
        setChaosState(readInterceptStateSafe());
      }
    }

    void bootLua();

    return () => {
      cancelled = true;
    };
  }, []);

  const parsedAmount = useMemo(() => {
    try {
      return parseAmount(amountInput, tokenInState.decimals);
    } catch {
      return 0n;
    }
  }, [amountInput, tokenInState.decimals]);

  const amountParseError = useMemo(() => {
    try {
      parseAmount(amountInput, tokenInState.decimals);
      return null;
    } catch {
      return "Amount format is invalid.";
    }
  }, [amountInput, tokenInState.decimals]);

  const overrides = useMemo(() => extractPresetOverrides(chaosState), [chaosState]);

  const warnings = useMemo(
    () =>
      resolveSwapWarnings({
        chainId: wallet?.chainId ?? null,
        expectedChainId: SEPOLIA_CHAIN_ID,
        amountIn: parsedAmount,
        balance: tokenInState.balance,
        allowance: tokenInState.allowance,
        priceImpactPct: quote?.priceImpactPct ?? 0,
        slippageOverridePct: overrides.slippagePctOverride,
        gasPriceOverrideGwei: overrides.gasPriceOverrideGwei,
        sampledGasPriceGwei: gasPriceGwei,
      }),
    [wallet, parsedAmount, tokenInState, quote, overrides, gasPriceGwei],
  );

  const requiresApproval =
    parsedAmount > 0n &&
    tokenInState.allowance >= 0n &&
    parsedAmount > tokenInState.allowance;

  const canSwap =
    Boolean(wallet) &&
    Boolean(quote) &&
    !requiresApproval &&
    !warnings.wrongNetwork &&
    !warnings.highSlippage &&
    !warnings.gasSpike &&
    !warnings.insufficientBalance &&
    !warnings.insufficientAllowance &&
    !swapping &&
    !approving;

  const swapViewState = useMemo(
    () =>
      resolveSwapViewState({
        walletConnected: Boolean(wallet),
        hasQuote: Boolean(quote),
        requiresApproval,
        approvalPending: approvalTx.status === "pending",
        swapPending: swapTx.status === "pending",
        swapFailed: swapTx.status === "failed",
        swapConfirmed: swapTx.status === "confirmed",
        readyToSwap: canSwap,
      }),
    [wallet, quote, requiresApproval, approvalTx, swapTx, canSwap],
  );

  const refreshTokenState = useCallback(
    async (session: ConnectedWallet, nextConfig: SwapEnvConfig) => {
      const [gas, tokenInRuntime, tokenOutRuntime] = await Promise.all([
        readGasPriceGwei(session.provider),
        hydrateTokenRuntime(
          session.provider,
          tokenInState.address,
          session.signerAddress,
          nextConfig.router,
          tokenInState.symbol,
        ),
        hydrateTokenRuntime(
          session.provider,
          tokenOutState.address,
          session.signerAddress,
          nextConfig.router,
          tokenOutState.symbol,
        ),
      ]);

      setGasPriceGwei(gas);
      setTokenInState(tokenInRuntime);
      setTokenOutState(tokenOutRuntime);
    },
    [tokenInState.address, tokenInState.symbol, tokenOutState.address, tokenOutState.symbol],
  );

  const connect = useCallback(async () => {
    if (!config) {
      return;
    }

    setConnecting(true);
    setAppError(null);

    try {
      const session = await connectWallet();
      setWallet(session);

      const pair = toTokenPairSeed(config);
      const [gas, tokenInRuntime, tokenOutRuntime] = await Promise.all([
        readGasPriceGwei(session.provider),
        hydrateTokenRuntime(
          session.provider,
          pair.tokenIn.address,
          session.signerAddress,
          config.router,
          "TOKEN_IN",
        ),
        hydrateTokenRuntime(
          session.provider,
          pair.tokenOut.address,
          session.signerAddress,
          config.router,
          "TOKEN_OUT",
        ),
      ]);

      setGasPriceGwei(gas);
      setTokenInState(tokenInRuntime);
      setTokenOutState(tokenOutRuntime);
      setQuote(null);
      setQuoteError(null);
      setApprovalTx({ type: "approve", status: "idle" });
      setSwapTx({ type: "swap", status: "idle" });
    } catch (error) {
      setAppError(error instanceof Error ? error.message : "Failed to connect wallet.");
    } finally {
      setConnecting(false);
    }
  }, [config]);

  const quoteSwap = useCallback(async () => {
    if (!wallet || !config) {
      return;
    }

    setQuoteLoading(true);
    setQuoteError(null);
    setAppError(null);

    try {
      const gas = await readGasPriceGwei(wallet.provider);
      setGasPriceGwei(gas);

      const amountIn = parseAmount(amountInput, tokenInState.decimals);
      const quoted = await quoteExactInputSingle(wallet.provider, {
        quoterAddress: config.quoterV2,
        tokenIn: tokenInState.address,
        tokenOut: tokenOutState.address,
        fee: config.poolFee,
        amountIn,
        outputDecimals: tokenOutState.decimals,
      });

      setQuote(quoted);
      setApprovalTx({ type: "approve", status: "idle" });
      setSwapTx({ type: "swap", status: "idle" });
    } catch (error) {
      setQuote(null);
      setQuoteError(error instanceof Error ? error.message : "Failed to fetch quote.");
    } finally {
      setQuoteLoading(false);
    }
  }, [wallet, config, amountInput, tokenInState, tokenOutState]);

  const approve = useCallback(async () => {
    if (!wallet || !config) {
      return;
    }

    setApproving(true);
    setAppError(null);
    const started = Date.now();

    try {
      const signer = await wallet.provider.getSigner();
      const txHash = await approveMax(signer, tokenInState.address, config.router);
      setApprovalTx({
        type: "approve",
        status: "pending",
        hash: txHash,
        submittedAtMs: started,
      });

      const receipt = await waitForReceipt(
        wallet.provider,
        txHash,
        DEFAULT_MAX_WAIT_MS,
        DEFAULT_POLL_MS,
      );

      if (!receipt || receipt.status !== 1) {
        setApprovalTx({
          type: "approve",
          status: "failed",
          hash: txHash,
          submittedAtMs: started,
          error: "Approval transaction reverted or timed out.",
        });
        return;
      }

      await refreshTokenState(wallet, config);
      setApprovalTx({
        type: "approve",
        status: "confirmed",
        hash: txHash,
        submittedAtMs: started,
        confirmedAtMs: Date.now(),
      });
    } catch (error) {
      setApprovalTx({
        type: "approve",
        status: "failed",
        submittedAtMs: started,
        error: error instanceof Error ? error.message : "Approval failed.",
      });
    } finally {
      setApproving(false);
    }
  }, [wallet, config, tokenInState.address, refreshTokenState]);

  const swap = useCallback(async () => {
    if (!wallet || !config || !quote) {
      return;
    }

    setSwapping(true);
    setAppError(null);
    const started = Date.now();

    try {
      const signer = await wallet.provider.getSigner();
      const amountIn = parseAmount(amountInput, tokenInState.decimals);
      const slippagePct = Math.max(
        0,
        Math.min(99, overrides.slippagePctOverride ?? Math.max(1, quote.priceImpactPct + 1)),
      );
      const slippageBps = Math.round(slippagePct * 100);
      const minOut =
        quote.amountOut * BigInt(Math.max(0, 10_000 - slippageBps)) / 10_000n;

      const txHash = await submitSwap(signer, {
        routerAddress: config.router,
        tokenIn: tokenInState.address,
        tokenOut: tokenOutState.address,
        fee: config.poolFee,
        recipient: wallet.signerAddress,
        amountIn,
        amountOutMinimum: minOut,
      });

      setSwapTx({
        type: "swap",
        status: "pending",
        hash: txHash,
        submittedAtMs: started,
      });

      const maxWaitMs = overrides.pendingForMs ?? DEFAULT_MAX_WAIT_MS;
      const receipt = await waitForReceipt(wallet.provider, txHash, maxWaitMs, DEFAULT_POLL_MS);

      if (!receipt) {
        setSwapTx({
          type: "swap",
          status: "pending",
          hash: txHash,
          submittedAtMs: started,
          error: `Still pending after ${Math.floor(maxWaitMs / 1000)}s`,
        });
        return;
      }

      if (receipt.status !== 1) {
        setSwapTx({
          type: "swap",
          status: "failed",
          hash: txHash,
          submittedAtMs: started,
          error: "Swap transaction reverted.",
        });
        return;
      }

      await refreshTokenState(wallet, config);
      setSwapTx({
        type: "swap",
        status: "confirmed",
        hash: txHash,
        submittedAtMs: started,
        confirmedAtMs: Date.now(),
      });
    } catch (error) {
      setSwapTx({
        type: "swap",
        status: "failed",
        submittedAtMs: started,
        error: error instanceof Error ? error.message : "Swap failed.",
      });
    } finally {
      setSwapping(false);
    }
  }, [wallet, config, quote, amountInput, tokenInState, tokenOutState, overrides, refreshTokenState]);

  const flipPair = useCallback(() => {
    setTokenInState((previousIn) => {
      setTokenOutState(previousIn);
      return tokenOutState;
    });
    setQuote(null);
    setQuoteError(null);
  }, [tokenOutState]);

  const applyLua = useCallback(
    async (
      lua: string,
      options?: {
        sourceLabel?: string;
        routeMocks?: RouteMock[];
        statePatch?: Record<string, unknown>;
      },
    ) => {
      const before = readInterceptStateSafe();
      const parsed = await loadLunaConfig(lua);

      if (parsed.intercept?.routes && parsed.intercept.routes.length > 0) {
        setRouteMocks(parsed.intercept.routes);
      }

      if (parsed.given && Object.keys(parsed.given).length > 0) {
        applyInterceptState(parsed.given);
      }

      if (parsed.intercept?.state && Object.keys(parsed.intercept.state).length > 0) {
        applyInterceptState(parsed.intercept.state);
      }

      if (parsed.intercept?.mockResponses && Object.keys(parsed.intercept.mockResponses).length > 0) {
        applyInterceptState({ mockResponses: parsed.intercept.mockResponses });
      }

      if (options?.routeMocks && options.routeMocks.length > 0) {
        setRouteMocks(options.routeMocks);
      }

      if (options?.statePatch && Object.keys(options.statePatch).length > 0) {
        applyInterceptState(options.statePatch);
      }

      const after = readInterceptStateSafe();
      setChaosState(after);
      setStateDiff(diffState(before, after));

      const label = options?.sourceLabel ?? parsed.name ?? "Lua";
      setLuaMessage(`${label} 적용 완료`);
      setLuaError(null);
    },
    [],
  );

  const applySelectedPreset = useCallback(async () => {
    const preset = chaosPresets.find((item) => item.id === selectedPresetId);
    if (!preset) {
      return;
    }

    try {
      await applyLua(preset.lua, {
        sourceLabel: preset.label,
        routeMocks: preset.routeMocks,
        statePatch: preset.statePatch,
      });
    } catch (error) {
      setLuaError(error instanceof Error ? error.message : "Preset apply failed.");
      setLuaMessage(null);
    }
  }, [chaosPresets, selectedPresetId, applyLua]);

  const applyLuaEditor = useCallback(async () => {
    try {
      const presets = await parseChaosPresetsFromLua(luaSource);
      setChaosPresets(presets);
      if (!presets.some((preset) => preset.id === selectedPresetId)) {
        setSelectedPresetId(presets[0]?.id ?? "");
      }

      await applyLua(luaSource, { sourceLabel: "Lua editor" });
    } catch (error) {
      setLuaError(error instanceof Error ? error.message : "Lua apply failed.");
      setLuaMessage(null);
    }
  }, [luaSource, selectedPresetId, applyLua]);

  if (!envResult.ok) {
    return (
      <main className="app-shell">
        <section className="card config-error">
          <h1>Swap Demo Configuration Error</h1>
          <p>{envResult.error}</p>
          {envResult.missing.length > 0 ? (
            <ul>
              {envResult.missing.map((key) => (
                <li key={key}>{key}</li>
              ))}
            </ul>
          ) : null}
          <p>Copy `examples/swap-dapp/.env.example` to `.env.local` and set valid Sepolia values.</p>
        </section>
      </main>
    );
  }

  const readyConfig = envResult.value;

  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">LunaTest Sample</p>
        <h1>Sepolia + Uniswap V3 Swap</h1>
        <p className="hero-copy">
          실지갑/실트랜잭션 경로를 기본으로 두고, 카오스 프리셋과 Lua 편집으로 극단 상황을 즉시
          재현합니다.
        </p>
        <dl className="network-meta">
          <div>
            <dt>Chain</dt>
            <dd>Sepolia (11155111)</dd>
          </div>
          <div>
            <dt>Factory</dt>
            <dd>{readyConfig.factory.slice(0, 8)}…{readyConfig.factory.slice(-4)}</dd>
          </div>
          <div>
            <dt>Router</dt>
            <dd>{readyConfig.router.slice(0, 8)}…{readyConfig.router.slice(-4)}</dd>
          </div>
          <div>
            <dt>QuoterV2</dt>
            <dd>{readyConfig.quoterV2.slice(0, 8)}…{readyConfig.quoterV2.slice(-4)}</dd>
          </div>
        </dl>
      </header>

      <section className="layout-grid">
        <TokenPairCard tokenIn={tokenInState} tokenOut={tokenOutState} onFlip={flipPair} />
        <AmountInput
          value={amountInput}
          onChange={setAmountInput}
          balanceLabel={`Balance: ${formatAmount(tokenInState.balance, tokenInState.decimals)} ${tokenInState.symbol}`}
        />
        <QuotePanel
          quote={quote}
          quoteError={quoteError ?? amountParseError}
          quoteLoading={quoteLoading}
          gasPriceGwei={gasPriceGwei}
        />
        <WarningPanel warnings={warnings} />
        <TxStepper state={swapViewState} />
        <ActionButtonRow
          connecting={connecting}
          quoting={quoteLoading}
          approving={approving}
          swapping={swapping}
          canConnect={!wallet}
          canQuote={Boolean(wallet) && parsedAmount > 0n && !warnings.wrongNetwork && !quoteLoading}
          canApprove={
            Boolean(wallet) &&
            parsedAmount > 0n &&
            requiresApproval &&
            !warnings.wrongNetwork &&
            !approving
          }
          canSwap={canSwap}
          onConnect={() => void connect()}
          onQuote={() => void quoteSwap()}
          onApprove={() => void approve()}
          onSwap={() => void swap()}
        />
      </section>

      <section className="card tx-card">
        <h2>Transaction Progress</h2>
        <dl>
          <div className="kv-row">
            <dt>Approval</dt>
            <dd>{approvalTx.status}</dd>
          </div>
          <div className="kv-row">
            <dt>Swap</dt>
            <dd>{swapTx.status}</dd>
          </div>
          <div className="kv-row">
            <dt>Allowance</dt>
            <dd>{formatAmount(tokenInState.allowance, tokenInState.decimals)} {tokenInState.symbol}</dd>
          </div>
          <div className="kv-row">
            <dt>Amount In</dt>
            <dd>{amountInput || "0"} {tokenInState.symbol}</dd>
          </div>
        </dl>
        {approvalTx.hash ? <p className="mono">Approve Tx: {approvalTx.hash}</p> : null}
        {swapTx.hash ? <p className="mono">Swap Tx: {swapTx.hash}</p> : null}
        {approvalTx.error ? <p className="error-text">{approvalTx.error}</p> : null}
        {swapTx.error ? <p className="error-text">{swapTx.error}</p> : null}
      </section>

      <section className="card chaos-card">
        <div className="chaos-header">
          <h2>Chaos Presets + Lua Editor</h2>
          <button type="button" className="ghost-button" onClick={() => setChaosState(readInterceptStateSafe())}>
            Refresh Runtime State
          </button>
        </div>
        <p className="subtle">
          기본 경로는 실지갑/실트랜잭션이며, 아래 액션은 인터셉트 상태만 변경합니다.
        </p>
        <div className="preset-row">
          <select
            value={selectedPresetId}
            onChange={(event) => setSelectedPresetId(event.currentTarget.value)}
          >
            {chaosPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => void applySelectedPreset()}>
            Apply Preset
          </button>
        </div>
        <p className="preset-desc">
          {chaosPresets.find((preset) => preset.id === selectedPresetId)?.description ?? "Preset not found."}
        </p>

        <label htmlFor="lua-editor" className="field-label">
          lunatest.lua
        </label>
        <textarea
          id="lua-editor"
          className="lua-editor"
          value={luaSource}
          onChange={(event) => setLuaSource(event.currentTarget.value)}
        />
        <div className="lua-action-row">
          <button type="button" onClick={() => void applyLuaEditor()}>
            Apply Lua
          </button>
        </div>
        {luaMessage ? <p className="success-text">{luaMessage}</p> : null}
        {luaError ? <p className="error-text">{luaError}</p> : null}
        {appError ? <p className="error-text">{appError}</p> : null}

        <div className="diff-panel">
          <h3>State Diff</h3>
          {stateDiff.length === 0 ? <p>No state diff yet.</p> : null}
          {stateDiff.length > 0 ? (
            <ul>
              {stateDiff.map((line) => (
                <li key={line} className="mono">
                  {line}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>
    </main>
  );
}
