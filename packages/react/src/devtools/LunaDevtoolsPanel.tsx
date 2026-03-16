import React, { useEffect, useMemo, useState } from "react";

import {
  executeLuaScenario,
  getProtocolPreset,
  getWalletPreset,
  listProtocolPresets,
  listWalletPresets,
  loadLunaConfig,
  materializeProtocolPreset,
  materializeWalletPreset,
} from "@lunatest/core";
import type {
  PresetParamDescriptor,
  PresetScenarioDescriptor,
  ProtocolPresetManifest,
  WalletPresetManifest,
} from "@lunatest/contracts";
import {
  applyInterceptState,
  connectWalletSession,
  disconnectWalletSession,
  getInterceptState,
  getWalletSession,
  setWalletSession,
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
  walletFallbackMode?: "off" | "manual-toggle";
};

function toPrettyJson(input: unknown): string {
  return JSON.stringify(input, null, 2);
}

function buildDefaultParamValues(
  schema: PresetParamDescriptor[],
): Record<string, string> {
  return Object.fromEntries(
    schema.map((item) => [item.key, item.default === undefined ? "" : String(item.default)]),
  );
}

function parsePresetValue(descriptor: PresetParamDescriptor, value: string): unknown {
  if (descriptor.type === "number" || descriptor.type === "chainId") {
    return Number(value);
  }

  if (descriptor.type === "boolean") {
    return value === "true";
  }

  return value;
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
  const [protocolPresets, setProtocolPresets] = useState<ProtocolPresetManifest[]>([]);
  const [walletPresets, setWalletPresets] = useState<WalletPresetManifest[]>([]);
  const [selectedProtocolPresetId, setSelectedProtocolPresetId] = useState("");
  const [selectedWalletPresetId, setSelectedWalletPresetId] = useState("");
  const [selectedBuiltinScenarioId, setSelectedBuiltinScenarioId] = useState("");
  const [presetParamValues, setPresetParamValues] = useState<Record<string, string>>({});
  const [presetParamsJson, setPresetParamsJson] = useState("{}");
  const [materializedPreview, setMaterializedPreview] = useState<string>("");
  const [walletSession, setWalletSessionState] = useState(() => {
    try {
      return getWalletSession();
    } catch {
      return null;
    }
  });

  const refreshWalletSession = () => {
    try {
      setWalletSessionState(getWalletSession());
    } catch {
      setWalletSessionState(null);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function loadBuiltIns(): Promise<void> {
      try {
        const [protocols, wallets] = await Promise.all([
          listProtocolPresets(),
          listWalletPresets(),
        ]);

        if (cancelled) {
          return;
        }

        setProtocolPresets(protocols);
        setWalletPresets(wallets);
        setSelectedProtocolPresetId((current) => current || protocols[0]?.id || "");
        setSelectedWalletPresetId((current) => current || wallets[0]?.id || "");
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      }
    }

    void loadBuiltIns();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedProtocolPreset = useMemo(
    () => protocolPresets.find((item) => item.id === selectedProtocolPresetId) ?? null,
    [protocolPresets, selectedProtocolPresetId],
  );

  const selectedWalletPreset = useMemo(
    () => walletPresets.find((item) => item.id === selectedWalletPresetId) ?? null,
    [walletPresets, selectedWalletPresetId],
  );

  const recommendedDescriptors = useMemo(() => {
    const descriptors = new Map<string, PresetParamDescriptor>();

    if (selectedProtocolPreset) {
      const keys = new Set(selectedProtocolPreset.recommendedControls);
      for (const descriptor of selectedProtocolPreset.paramsSchema) {
        if (keys.has(descriptor.key)) {
          descriptors.set(descriptor.key, descriptor);
        }
      }
    }

    if (selectedWalletPreset?.paramsSchema) {
      const keys = new Set(selectedWalletPreset.recommendedControls ?? []);
      for (const descriptor of selectedWalletPreset.paramsSchema) {
        if (keys.has(descriptor.key) && !descriptors.has(descriptor.key)) {
          descriptors.set(descriptor.key, descriptor);
        }
      }
    }

    return Array.from(descriptors.values());
  }, [selectedProtocolPreset, selectedWalletPreset]);

  useEffect(() => {
    if (!selectedProtocolPreset) {
      return;
    }

    setPresetParamValues(buildDefaultParamValues(selectedProtocolPreset.paramsSchema));
    setSelectedBuiltinScenarioId(selectedProtocolPreset.builtinScenarios[0]?.id ?? "");
    if (!selectedWalletPresetId) {
      setSelectedWalletPresetId(selectedProtocolPreset.defaultWalletPreset.id);
    }
  }, [selectedProtocolPreset, selectedWalletPresetId]);

  const buildPresetParams = () => {
    const params: Record<string, unknown> = {};

    for (const descriptor of recommendedDescriptors) {
      const current = presetParamValues[descriptor.key];
      if (current === undefined || current === "") {
        continue;
      }

      params[descriptor.key] = parsePresetValue(descriptor, current);
    }

    const advanced = JSON.parse(presetParamsJson) as Record<string, unknown>;
    return {
      ...params,
      ...advanced,
    };
  };

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
      refreshWalletSession();
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
      refreshWalletSession();
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
      refreshWalletSession();
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
    refreshWalletSession();
  };

  const handleApplyProtocolPreset = async () => {
    if (!selectedProtocolPresetId) {
      return;
    }

    setError(null);
    setStatus("applying-protocol-preset");
    try {
      const params = buildPresetParams();
      const materialized = await materializeProtocolPreset(selectedProtocolPresetId, params);
      let nextWalletSession = materialized.walletSession;

      if (selectedWalletPresetId && selectedWalletPresetId !== materialized.walletPresetId) {
        const walletMaterialized = await materializeWalletPreset(selectedWalletPresetId, params);
        nextWalletSession = walletMaterialized.walletSession;
      }

      setWalletSession(nextWalletSession);
      setRouteMocks(materialized.routeMocks);
      applyInterceptState(materialized.interceptState);
      setMaterializedPreview(toPrettyJson(materialized));
      setSelectedWalletPresetId(materialized.walletPresetId);

      const scenario =
        materialized.builtinScenarios.find((item) => item.id === selectedBuiltinScenarioId) ??
        materialized.builtinScenarios[0];
      if (scenario) {
        setLuaScript(scenario.lua);
      }

      refreshWalletSession();
      setStatus("protocol-preset-applied");
    } catch (cause) {
      setStatus("failed");
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const handleApplyWalletPreset = async () => {
    if (!selectedWalletPresetId) {
      return;
    }

    setError(null);
    setStatus("applying-wallet-preset");
    try {
      const materialized = await materializeWalletPreset(selectedWalletPresetId, buildPresetParams());
      setWalletSession(materialized.walletSession);
      setMaterializedPreview(toPrettyJson(materialized));
      refreshWalletSession();
      setStatus("wallet-preset-applied");
    } catch (cause) {
      setStatus("failed");
      setError(cause instanceof Error ? cause.message : String(cause));
    }
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

      <h4 style={{ margin: 0, marginBottom: 8 }}>Protocol Preset</h4>
      <label htmlFor="lunatest-protocol-preset">Protocol Preset</label>
      <select
        id="lunatest-protocol-preset"
        value={selectedProtocolPresetId}
        onChange={(event) => setSelectedProtocolPresetId(event.currentTarget.value)}
        style={{ width: "100%", marginBottom: 8 }}
      >
        {protocolPresets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.label}
          </option>
        ))}
      </select>

      <label htmlFor="lunatest-wallet-preset">Wallet Preset</label>
      <select
        id="lunatest-wallet-preset"
        value={selectedWalletPresetId}
        onChange={(event) => setSelectedWalletPresetId(event.currentTarget.value)}
        style={{ width: "100%", marginBottom: 8 }}
      >
        {walletPresets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.label}
          </option>
        ))}
      </select>

      {recommendedDescriptors.length > 0 ? (
        <>
          <h4 style={{ margin: 0, marginBottom: 8 }}>Recommended Controls</h4>
          {recommendedDescriptors.map((descriptor) => (
            <div key={descriptor.key} style={{ marginBottom: 8 }}>
              <label htmlFor={`preset-control-${descriptor.key}`}>{descriptor.label}</label>
              <input
                id={`preset-control-${descriptor.key}`}
                value={presetParamValues[descriptor.key] ?? ""}
                onChange={(event) =>
                  setPresetParamValues((current) => ({
                    ...current,
                    [descriptor.key]: event.currentTarget.value,
                  }))
                }
                style={{ width: "100%" }}
              />
            </div>
          ))}
        </>
      ) : null}

      <label htmlFor="lunatest-preset-params">Advanced Preset Params (JSON)</label>
      <textarea
        id="lunatest-preset-params"
        value={presetParamsJson}
        onChange={(event) => setPresetParamsJson(event.currentTarget.value)}
        style={{ width: "100%", minHeight: 90, marginBottom: 8 }}
      />

      {selectedProtocolPreset?.builtinScenarios?.length ? (
        <>
          <label htmlFor="lunatest-builtin-scenario">Built-in Scenario</label>
          <select
            id="lunatest-builtin-scenario"
            value={selectedBuiltinScenarioId}
            onChange={(event) => setSelectedBuiltinScenarioId(event.currentTarget.value)}
            style={{ width: "100%", marginBottom: 8 }}
          >
            {selectedProtocolPreset.builtinScenarios.map((scenario: PresetScenarioDescriptor) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.label}
              </option>
            ))}
          </select>
        </>
      ) : null}

      <button type="button" onClick={handleApplyProtocolPreset}>
        Apply Protocol Preset
      </button>
      <button type="button" style={{ marginLeft: 8 }} onClick={handleApplyWalletPreset}>
        Apply Wallet Preset
      </button>

      {materializedPreview ? (
        <>
          <p style={{ marginTop: 10, marginBottom: 4 }}>materialized:</p>
          <pre style={{ marginTop: 0, whiteSpace: "pre-wrap" }}>{materializedPreview}</pre>
        </>
      ) : null}

      {props.walletFallbackMode === "manual-toggle" ? (
        <>
          <hr />

          <h4 style={{ margin: 0, marginBottom: 8 }}>Luna Wallet</h4>
          <p style={{ margin: 0, marginBottom: 8, color: "#334155" }}>
            지갑이 없어도 wallet RPC를 Luna session으로 하이재킹합니다.
          </p>
          <p style={{ margin: 0, marginBottom: 8 }}>
            mode: {walletSession?.enabled ? "on" : "off"} / connected: {walletSession?.connected ? "yes" : "no"}
          </p>
          <p style={{ margin: 0, marginBottom: 8 }}>
            account: {walletSession?.accounts?.[0] ?? "n/a"}
          </p>
          <p style={{ margin: 0, marginBottom: 8 }}>
            chain: {walletSession?.chainId ?? "n/a"}
          </p>
          <p style={{ margin: 0, marginBottom: 8 }}>
            permissions: {walletSession?.permissions?.map((item: { parentCapability: string }) => item.parentCapability).join(", ") || "none"}
          </p>
          <button
            type="button"
            onClick={() => {
              try {
                if (walletSession?.enabled) {
                  disconnectWalletSession();
                } else {
                  connectWalletSession();
                }
                refreshWalletSession();
                setStatus("wallet-updated");
                setError(null);
              } catch (cause) {
                setStatus("failed");
                setError(cause instanceof Error ? cause.message : String(cause));
              }
            }}
          >
            {walletSession?.enabled ? "Disable Luna Wallet" : "Enable Luna Wallet"}
          </button>
          <button
            type="button"
            style={{ marginLeft: 8 }}
            onClick={() => {
              try {
                setWalletSession({
                  enabled: walletSession?.enabled ?? false,
                  connected: walletSession?.connected ?? false,
                  chainId: "0xaa36a7",
                  accounts: ["0x1111111111111111111111111111111111111111"],
                  permissions: walletSession?.permissions ?? [],
                });
                refreshWalletSession();
                setStatus("wallet-updated");
                setError(null);
              } catch (cause) {
                setStatus("failed");
                setError(cause instanceof Error ? cause.message : String(cause));
              }
            }}
          >
            Reset Session
          </button>
        </>
      ) : null}

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
