import React, { useMemo, useState } from "react";

import { executeLuaScenario, loadLunaConfig } from "@lunatest/core";
import {
  applyInterceptState,
  getInterceptState,
  setRouteMocks,
  type RouteMock,
} from "@lunatest/runtime-intercept";

type LunaDevtoolsPanelProps = {
  title?: string;
  initialLua?: string;
  initialRoutes?: RouteMock[];
  initialState?: Record<string, unknown>;
  onRunScenario?: (
    luaScript: string,
  ) => Promise<{ pass: boolean; error?: string; diff?: string }> | { pass: boolean; error?: string; diff?: string };
  onSetRouteMocks?: (routes: RouteMock[]) => void | Promise<void>;
  onPatchState?: (patch: Record<string, unknown>) => void | Promise<void>;
};

function toPrettyJson(input: unknown): string {
  return JSON.stringify(input, null, 2);
}

export function LunaDevtoolsPanel(props: LunaDevtoolsPanelProps) {
  const initialLuaScript = useMemo(
    () =>
      props.initialLua ??
      `scenario {
  name = "swap-warning",
  mode = "strict",
  given = {
    pool = { pair = "ETH/USDC", reserve0 = 100, reserve1 = 183000 },
    wallet = { connected = true, ETH = 10.0 },
  },
  when = { action = "swap", input = { tokenIn = "ETH", amount = 50.0 } },
  then_ui = { slippage_warning = true, severity = "high", button_disabled = true },
}`,
    [props.initialLua],
  );

  const defaultRoutes = useMemo(
    () =>
      props.initialRoutes ?? [
        {
          endpointType: "ethereum" as const,
          method: "eth_chainId",
          responseKey: "chain-id",
        },
      ],
    [props.initialRoutes],
  );

  const defaultState = useMemo(
    () =>
      props.initialState ?? {
        chain: { id: 1, gasPrice: 30 },
      },
    [props.initialState],
  );

  const [luaScript, setLuaScript] = useState<string>(initialLuaScript);
  const [routeJson, setRouteJson] = useState<string>(toPrettyJson(defaultRoutes));
  const [stateJson, setStateJson] = useState<string>(toPrettyJson(defaultState));
  const [status, setStatus] = useState<string>("idle");
  const [error, setError] = useState<string | null>(null);
  const [diff, setDiff] = useState<string | null>(null);

  const handleRun = async () => {
    setError(null);
    setDiff(null);
    setStatus("running");
    try {
      const executed = props.onRunScenario
        ? await props.onRunScenario(luaScript)
        : await (async () => {
          const config = await loadLunaConfig(luaScript);
          const result = await executeLuaScenario({
            source: config,
            adapter: {
              runWhen: async ({ config: nextConfig, runtime }) => {
                if (nextConfig.intercept?.routes) {
                  runtime.setRouteMocks(nextConfig.intercept.routes);
                  setRouteMocks(nextConfig.intercept.routes);
                }

                if (nextConfig.given) {
                  runtime.applyInterceptState(nextConfig.given);
                  applyInterceptState(nextConfig.given);
                }

                if (nextConfig.intercept?.state) {
                  runtime.applyInterceptState(nextConfig.intercept.state);
                  applyInterceptState(nextConfig.intercept.state);
                }
              },
              resolveUi: async () => getInterceptState(),
              resolveState: async () => getInterceptState(),
            },
          });

          return {
            pass: result.pass,
            error: result.error,
            diff: result.result?.diff,
          };
        })();

      setStatus(executed.pass ? "pass" : "fail");
      if (executed.error) {
        setError(executed.error);
      }
      if (executed.diff) {
        setDiff(executed.diff);
      }
    } catch (cause) {
      setStatus("failed");
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const handleApplyRoutes = async () => {
    setError(null);
    setDiff(null);
    setStatus("updating-routes");
    try {
      const parsed = JSON.parse(routeJson) as RouteMock[];
      if (props.onSetRouteMocks) {
        await props.onSetRouteMocks(parsed);
      } else {
        setRouteMocks(parsed);
      }
      setStatus("routes-updated");
    } catch (cause) {
      setStatus("failed");
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const handlePatchState = async () => {
    setError(null);
    setDiff(null);
    setStatus("patching-state");
    try {
      const parsed = JSON.parse(stateJson) as Record<string, unknown>;
      if (props.onPatchState) {
        await props.onPatchState(parsed);
      } else {
        applyInterceptState(parsed);
      }
      setStatus("state-patched");
    } catch (cause) {
      setStatus("failed");
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const handleReset = () => {
    setLuaScript(initialLuaScript);
    setRouteJson(toPrettyJson(defaultRoutes));
    setStateJson(toPrettyJson(defaultState));
    setStatus("reset");
    setError(null);
    setDiff(null);
  };

  return (
    <aside
      data-lunatest-devtools
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        width: 380,
        maxHeight: "80vh",
        overflow: "auto",
        zIndex: 99999,
        border: "1px solid #cbd5e1",
        borderRadius: 12,
        background: "#ffffff",
        boxShadow: "0 12px 30px rgba(15, 23, 42, 0.18)",
        fontFamily: "monospace",
        fontSize: 12,
        color: "#0f172a",
        padding: 12,
      }}
    >
      <h3 style={{ margin: 0, marginBottom: 8 }}>
        {props.title ?? "LunaTest Devtools"}
      </h3>
      <p style={{ margin: 0, marginBottom: 10, color: "#334155" }}>
        Lua DSL과 인터셉트 상태를 브라우저에서 바로 수정합니다.
      </p>

      <label htmlFor="lunatest-lua-script">Lua Scenario</label>
      <textarea
        id="lunatest-lua-script"
        value={luaScript}
        onChange={(event) => setLuaScript(event.currentTarget.value)}
        style={{ width: "100%", minHeight: 140, marginBottom: 8 }}
      />
      <button type="button" onClick={handleRun}>
        Run Scenario
      </button>

      <hr />

      <label htmlFor="lunatest-routes">Route Mocks (JSON array)</label>
      <textarea
        id="lunatest-routes"
        value={routeJson}
        onChange={(event) => setRouteJson(event.currentTarget.value)}
        style={{ width: "100%", minHeight: 110, marginBottom: 8 }}
      />
      <button type="button" onClick={handleApplyRoutes}>
        Apply Routes
      </button>

      <hr />

      <label htmlFor="lunatest-state">Intercept State Patch (JSON object)</label>
      <textarea
        id="lunatest-state"
        value={stateJson}
        onChange={(event) => setStateJson(event.currentTarget.value)}
        style={{ width: "100%", minHeight: 110, marginBottom: 8 }}
      />
      <button type="button" onClick={handlePatchState}>
        Patch State
      </button>
      <button type="button" onClick={handleReset} style={{ marginLeft: 8 }}>
        Reset
      </button>

      <p style={{ marginTop: 10, marginBottom: 0 }}>status: {status}</p>
      {error ? (
        <p style={{ marginTop: 4, marginBottom: 0, color: "#b91c1c" }}>error: {error}</p>
      ) : null}
      {diff ? (
        <pre style={{ marginTop: 8, marginBottom: 0, color: "#7f1d1d", whiteSpace: "pre-wrap" }}>
          diff: {diff}
        </pre>
      ) : null}
    </aside>
  );
}
