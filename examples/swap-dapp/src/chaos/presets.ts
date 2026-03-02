import { loadLunaConfig, type LuaConfig } from "@lunatest/core";
import type { RouteMock } from "@lunatest/runtime-intercept";
import type { ChaosPreset } from "../types";

type LuaConfigWithPresets = LuaConfig & {
  presets?: Record<string, unknown>;
};

const HIGH_SLIPPAGE_LUA = `scenario {
  name = "high_slippage_80",
  mode = "permissive",
  given = {
    chaos = {
      slippagePctOverride = 80,
      preset = "high_slippage_80",
    },
  },
  intercept = { routes = {}, state = {} },
}`;

const GAS_SPIKE_LUA = `scenario {
  name = "gas_spike_500_gwei",
  mode = "permissive",
  given = {
    chain = { gasPriceGwei = 500 },
    chaos = {
      gasPriceOverrideGwei = 500,
      preset = "gas_spike_500_gwei",
    },
  },
  intercept = { routes = {}, state = {} },
}`;

const PENDING_LUA = `scenario {
  name = "pending_10m",
  mode = "permissive",
  given = {
    chaos = {
      pendingForMs = 600000,
      preset = "pending_10m",
    },
  },
  intercept = {
    routes = {
      { endpointType = "ethereum", method = "eth_sendTransaction", responseKey = "chaos.pending.tx_hash" },
      { endpointType = "ethereum", method = "eth_getTransactionReceipt", responseKey = "chaos.pending.tx_receipt" },
    },
    state = {
      mockResponses = {
        ["chaos.pending.tx_hash"] = { result = "0x7f9a3f8fcb8c2e97a5e5e9845f3c4d4f17a4bc6fcdcae3b5bdf6fd2a0d6f4d91" },
        ["chaos.pending.tx_receipt"] = { result = nil },
      },
    },
  },
}`;

export const DEFAULT_CHAOS_PRESETS: ChaosPreset[] = [
  {
    id: "high_slippage_80",
    label: "Slippage 80%",
    description: "대규모 가격 충격 상황을 즉시 재현합니다.",
    lua: HIGH_SLIPPAGE_LUA,
    routeMocks: [],
    statePatch: {
      chaos: {
        preset: "high_slippage_80",
        slippagePctOverride: 80,
      },
    },
  },
  {
    id: "gas_spike_500_gwei",
    label: "Gas 500 Gwei",
    description: "가스 급등으로 비용 경고/버튼 정책을 검증합니다.",
    lua: GAS_SPIKE_LUA,
    routeMocks: [],
    statePatch: {
      chain: {
        gasPriceGwei: 500,
      },
      chaos: {
        preset: "gas_spike_500_gwei",
        gasPriceOverrideGwei: 500,
      },
    },
  },
  {
    id: "pending_10m",
    label: "Pending 10m",
    description: "트랜잭션이 장시간 pending인 네트워크 혼잡을 재현합니다.",
    lua: PENDING_LUA,
    routeMocks: [
      {
        endpointType: "ethereum",
        method: "eth_sendTransaction",
        responseKey: "chaos.pending.tx_hash",
      },
      {
        endpointType: "ethereum",
        method: "eth_getTransactionReceipt",
        responseKey: "chaos.pending.tx_receipt",
      },
    ],
    statePatch: {
      chaos: {
        preset: "pending_10m",
        pendingForMs: 600000,
      },
      mockResponses: {
        "chaos.pending.tx_hash": {
          result: "0x7f9a3f8fcb8c2e97a5e5e9845f3c4d4f17a4bc6fcdcae3b5bdf6fd2a0d6f4d91",
        },
        "chaos.pending.tx_receipt": {
          result: null,
        },
      },
    },
  },
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asRouteMocks(value: unknown): RouteMock[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is RouteMock => {
    const row = asRecord(item);
    if (!row) {
      return false;
    }

    if (typeof row.endpointType !== "string") {
      return false;
    }

    if (typeof row.responseKey !== "string") {
      return false;
    }

    if (row.endpointType === "ethereum") {
      return typeof row.method === "string";
    }

    return "urlPattern" in row;
  });
}

export async function loadLuaSource(path = "./lunatest.lua"): Promise<string> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load Lua source: ${path} (${response.status})`);
  }

  return response.text();
}

export async function parseChaosPresetsFromLua(luaSource: string): Promise<ChaosPreset[]> {
  const parsed = (await loadLunaConfig(luaSource)) as LuaConfigWithPresets;
  const presets = asRecord(parsed.presets);
  if (!presets) {
    return DEFAULT_CHAOS_PRESETS;
  }

  const entries: ChaosPreset[] = [];

  for (const [id, raw] of Object.entries(presets)) {
    const row = asRecord(raw);
    if (!row || typeof row.lua !== "string") {
      continue;
    }

    entries.push({
      id,
      label: typeof row.label === "string" ? row.label : id,
      description: typeof row.description === "string" ? row.description : "",
      lua: row.lua,
      routeMocks: asRouteMocks(row.routeMocks),
      statePatch: asRecord(row.statePatch) ?? {},
    });
  }

  if (entries.length === 0) {
    return DEFAULT_CHAOS_PRESETS;
  }

  return entries;
}

export function extractPresetOverrides(state: Record<string, unknown>): {
  slippagePctOverride: number | null;
  gasPriceOverrideGwei: number | null;
  pendingForMs: number | null;
} {
  const chaos = asRecord(state.chaos) ?? {};
  const chain = asRecord(state.chain) ?? {};

  const slippage = Number(chaos.slippagePctOverride);
  const gas = Number(chaos.gasPriceOverrideGwei ?? chain.gasPriceGwei);
  const pending = Number(chaos.pendingForMs);

  return {
    slippagePctOverride: Number.isFinite(slippage) ? slippage : null,
    gasPriceOverrideGwei: Number.isFinite(gas) ? gas : null,
    pendingForMs: Number.isFinite(pending) ? pending : null,
  };
}
