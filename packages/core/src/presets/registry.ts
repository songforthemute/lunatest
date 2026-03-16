import {
  asRecord,
  createLunaWalletSession,
  deepMerge,
  parseProtocolPresetManifest,
  parseWalletPresetManifest,
  type ProtocolPresetManifest,
  type ProtocolPresetMaterialization,
  type PresetParamDescriptor,
  type WalletPresetManifest,
  type WalletPresetMaterialization,
  type WalletPresetReference,
} from "@lunatest/contracts";

import { loadLuaPresetModule } from "./loader.js";

const BUILTIN_PROTOCOL_SOURCES: Record<string, URL> = {
  uniswap_v2: new URL("./protocol/uniswap_v2.lua", import.meta.url),
  uniswap_v3: new URL("./protocol/uniswap_v3.lua", import.meta.url),
  curve: new URL("./protocol/curve.lua", import.meta.url),
  aave: new URL("./protocol/aave.lua", import.meta.url),
};

const BUILTIN_WALLET_SOURCES: Record<string, URL> = {
  empty_wallet: new URL("./wallet/empty_wallet.lua", import.meta.url),
  demo_sepolia: new URL("./wallet/demo_sepolia.lua", import.meta.url),
};

type LoadedProtocolPreset = {
  manifest: ProtocolPresetManifest;
  materialize: (params?: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

type LoadedWalletPreset = {
  manifest: WalletPresetManifest;
  materialize: (params?: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

const protocolCache = new Map<string, Promise<LoadedProtocolPreset>>();
const walletCache = new Map<string, Promise<LoadedWalletPreset>>();

function toChainNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.startsWith("0x")) {
    return Number.parseInt(value, 16);
  }

  if (typeof value === "string" && value.length > 0) {
    return Number(value);
  }

  return null;
}

function resolveParamDefaults(
  schema: PresetParamDescriptor[],
  input: Record<string, unknown> = {},
): Record<string, unknown> {
  const resolved: Record<string, unknown> = { ...input };

  for (const descriptor of schema) {
    if (resolved[descriptor.key] === undefined && descriptor.default !== undefined) {
      resolved[descriptor.key] = descriptor.default;
    }
  }

  return resolved;
}

async function loadProtocolPreset(id: string): Promise<LoadedProtocolPreset | null> {
  const source = BUILTIN_PROTOCOL_SOURCES[id];
  if (!source) {
    return null;
  }

  if (!protocolCache.has(id)) {
    protocolCache.set(
      id,
      (async () => {
        const module = await loadLuaPresetModule(source);
        return {
          manifest: parseProtocolPresetManifest(module.manifest),
          async materialize(params = {}) {
            return (await module.materialize(params)) as Record<string, unknown>;
          },
        };
      })(),
    );
  }

  return protocolCache.get(id)!;
}

async function loadWalletPreset(id: string): Promise<LoadedWalletPreset | null> {
  const source = BUILTIN_WALLET_SOURCES[id];
  if (!source) {
    return null;
  }

  if (!walletCache.has(id)) {
    walletCache.set(
      id,
      (async () => {
        const module = await loadLuaPresetModule(source);
        return {
          manifest: parseWalletPresetManifest(module.manifest),
          async materialize(params = {}) {
            return (await module.materialize(params)) as Record<string, unknown>;
          },
        };
      })(),
    );
  }

  return walletCache.get(id)!;
}

function mergeWalletReference(
  walletSession: Record<string, unknown>,
  reference: WalletPresetReference,
  rawOverrides: Record<string, unknown> | null,
) {
  const mergedReferenceOverrides = asRecord(reference.overrides) ?? {};
  const mergedRawOverrides = rawOverrides ?? {};

  return createLunaWalletSession(
    deepMerge(
      deepMerge(walletSession, mergedReferenceOverrides),
      mergedRawOverrides,
    ),
  );
}

export async function listProtocolPresets(): Promise<ProtocolPresetManifest[]> {
  const presets = await Promise.all(
    Object.keys(BUILTIN_PROTOCOL_SOURCES).map(async (id) => {
      const preset = await loadProtocolPreset(id);
      return preset?.manifest ?? null;
    }),
  );

  return presets.filter((item): item is ProtocolPresetManifest => item !== null);
}

export async function getProtocolPreset(id: string): Promise<ProtocolPresetManifest | null> {
  const preset = await loadProtocolPreset(id);
  return preset?.manifest ?? null;
}

export async function listWalletPresets(): Promise<WalletPresetManifest[]> {
  const presets = await Promise.all(
    Object.keys(BUILTIN_WALLET_SOURCES).map(async (id) => {
      const preset = await loadWalletPreset(id);
      return preset?.manifest ?? null;
    }),
  );

  return presets.filter((item): item is WalletPresetManifest => item !== null);
}

export async function getWalletPreset(id: string): Promise<WalletPresetManifest | null> {
  const preset = await loadWalletPreset(id);
  return preset?.manifest ?? null;
}

export async function materializeWalletPreset(
  id: string,
  params: Record<string, unknown> = {},
): Promise<WalletPresetMaterialization> {
  const preset = await loadWalletPreset(id);
  if (!preset) {
    throw new Error(`Wallet preset not found: ${id}`);
  }

  const resolvedParams = resolveParamDefaults(preset.manifest.paramsSchema ?? [], params);
  const raw = await preset.materialize(resolvedParams);
  const rawSession = asRecord(raw.defaultSession) ?? {};
  const walletSession = createLunaWalletSession(
    deepMerge(
      preset.manifest.defaultSession as Record<string, unknown>,
      rawSession,
    ),
  );

  const chainId = toChainNumber(resolvedParams.chainId ?? walletSession.chainId);
  if (chainId !== null && !preset.manifest.supportedChains.includes(chainId)) {
    throw new Error(`Wallet preset ${id} does not support chain ${chainId}`);
  }

  return {
    walletPresetId: preset.manifest.id,
    resolvedParams,
    walletSession,
  };
}

export async function materializeProtocolPreset(
  id: string,
  params: Record<string, unknown> = {},
): Promise<ProtocolPresetMaterialization> {
  const preset = await loadProtocolPreset(id);
  if (!preset) {
    throw new Error(`Protocol preset not found: ${id}`);
  }

  const resolvedParams = resolveParamDefaults(preset.manifest.paramsSchema, params);
  const chainId = toChainNumber(resolvedParams.chainId);
  if (chainId !== null && !preset.manifest.supportedChains.includes(chainId)) {
    throw new Error(`Protocol preset ${id} does not support chain ${chainId}`);
  }

  const raw = await preset.materialize(resolvedParams);
  const walletReference = (asRecord(raw.walletPreset) as WalletPresetReference | null) ?? preset.manifest.defaultWalletPreset;
  const walletMaterialization = await materializeWalletPreset(walletReference.id, resolvedParams);
  const walletSession = mergeWalletReference(
    walletMaterialization.walletSession as unknown as Record<string, unknown>,
    walletReference,
    asRecord(raw.walletSessionOverrides),
  );

  return {
    protocolPresetId: preset.manifest.id,
    walletPresetId: walletReference.id,
    resolvedParams: asRecord(raw.resolvedParams) ?? resolvedParams,
    walletSession,
    interceptState: deepMerge(
      preset.manifest.defaultInterceptState,
      asRecord(raw.interceptState) ?? {},
    ),
    routeMocks: [
      ...preset.manifest.defaultRouteMocks,
      ...(Array.isArray(raw.routeMocks)
        ? (raw.routeMocks as ProtocolPresetMaterialization["routeMocks"])
        : []),
    ],
    builtinScenarios: Array.isArray(raw.builtinScenarios)
      ? (raw.builtinScenarios as ProtocolPresetMaterialization["builtinScenarios"])
      : preset.manifest.builtinScenarios,
  };
}
