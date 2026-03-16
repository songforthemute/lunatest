import {
  asRecord,
  createLunaWalletSession,
  deepMerge,
  parseProtocolPresetManifest,
  parseWalletPresetManifest,
  qualifyPresetId,
  type PresetParamDescriptor,
  type PresetSource,
  type ProtocolPresetCatalogEntry,
  type ProtocolPresetManifest,
  type ProtocolPresetMaterialization,
  type WalletPresetCatalogEntry,
  type WalletPresetManifest,
  type WalletPresetMaterialization,
  type WalletPresetReference,
} from "@lunatest/contracts";

import { loadLuaPresetModule } from "./loader.js";

export type PresetSourceInput = string | URL;

export type ProjectPresetSources = {
  protocol?: Record<string, PresetSourceInput>;
  wallet?: Record<string, PresetSourceInput>;
};

export type PresetRegistry = {
  protocolSources: Record<string, { source: PresetSource; input: PresetSourceInput }>;
  walletSources: Record<string, { source: PresetSource; input: PresetSourceInput }>;
  protocolCache: Map<string, Promise<LoadedProtocolPreset>>;
  walletCache: Map<string, Promise<LoadedWalletPreset>>;
};

export type PresetRegistryOptions = {
  projectSources?: ProjectPresetSources;
};

type LoadedProtocolPreset = {
  entry: ProtocolPresetCatalogEntry;
  materialize: (params?: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

type LoadedWalletPreset = {
  entry: WalletPresetCatalogEntry;
  materialize: (params?: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

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

let defaultRegistry: PresetRegistry | null = null;

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

function buildSourceMap(
  builtins: Record<string, URL>,
  project: Record<string, PresetSourceInput> | undefined,
): Record<string, { source: PresetSource; input: PresetSourceInput }> {
  const sources: Record<string, { source: PresetSource; input: PresetSourceInput }> = {};

  for (const [id, input] of Object.entries(builtins)) {
    sources[qualifyPresetId("builtin", id)] = {
      source: "builtin",
      input,
    };
  }

  const seenProjectIds = new Set<string>();
  for (const [id, input] of Object.entries(project ?? {})) {
    const qualifiedId = qualifyPresetId("project", id);
    if (seenProjectIds.has(qualifiedId)) {
      throw new Error(`Duplicate project preset id: ${qualifiedId}`);
    }
    seenProjectIds.add(qualifiedId);
    sources[qualifiedId] = {
      source: "project",
      input,
    };
  }

  return sources;
}

function toProtocolEntry(
  manifest: ProtocolPresetManifest,
  source: PresetSource,
): ProtocolPresetCatalogEntry {
  return {
    ...manifest,
    qualifiedId: qualifyPresetId(source, manifest.id),
    source,
  };
}

function toWalletEntry(
  manifest: WalletPresetManifest,
  source: PresetSource,
): WalletPresetCatalogEntry {
  return {
    ...manifest,
    qualifiedId: qualifyPresetId(source, manifest.id),
    source,
  };
}

function resolveQualifiedId(
  registry: PresetRegistry,
  id: string,
  kind: "protocol" | "wallet",
): string | null {
  const sources = kind === "protocol" ? registry.protocolSources : registry.walletSources;
  if (sources[id]) {
    return id;
  }

  const builtinId = qualifyPresetId("builtin", id);
  if (sources[builtinId]) {
    return builtinId;
  }

  const projectId = qualifyPresetId("project", id);
  if (sources[projectId]) {
    return projectId;
  }

  return null;
}

async function loadProtocolPreset(
  registry: PresetRegistry,
  id: string,
): Promise<LoadedProtocolPreset | null> {
  const qualifiedId = resolveQualifiedId(registry, id, "protocol");
  if (!qualifiedId) {
    return null;
  }

  if (!registry.protocolCache.has(qualifiedId)) {
    const sourceInfo = registry.protocolSources[qualifiedId];
    registry.protocolCache.set(
      qualifiedId,
      (async () => {
        const module = await loadLuaPresetModule(sourceInfo.input);
        return {
          entry: toProtocolEntry(
            parseProtocolPresetManifest(module.manifest),
            sourceInfo.source,
          ),
          async materialize(params = {}) {
            return (await module.materialize(params)) as Record<string, unknown>;
          },
        };
      })(),
    );
  }

  return registry.protocolCache.get(qualifiedId)!;
}

async function loadWalletPreset(
  registry: PresetRegistry,
  id: string,
): Promise<LoadedWalletPreset | null> {
  const qualifiedId = resolveQualifiedId(registry, id, "wallet");
  if (!qualifiedId) {
    return null;
  }

  if (!registry.walletCache.has(qualifiedId)) {
    const sourceInfo = registry.walletSources[qualifiedId];
    registry.walletCache.set(
      qualifiedId,
      (async () => {
        const module = await loadLuaPresetModule(sourceInfo.input);
        return {
          entry: toWalletEntry(
            parseWalletPresetManifest(module.manifest),
            sourceInfo.source,
          ),
          async materialize(params = {}) {
            return (await module.materialize(params)) as Record<string, unknown>;
          },
        };
      })(),
    );
  }

  return registry.walletCache.get(qualifiedId)!;
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

async function readPresetDir(
  root: string,
  bucket: Record<string, PresetSourceInput>,
  baseDir = root,
): Promise<void> {
  const { readdir } = await import("node:fs/promises");
  const path = await import("node:path");
  const entries = await readdir(root, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      await readPresetDir(absolutePath, bucket, baseDir);
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith(".lua")) {
      continue;
    }

    const relativePath = path.relative(baseDir, absolutePath).replace(/\\/g, "/");
    const id = relativePath.replace(/\.lua$/u, "");
    bucket[id] = absolutePath;
  }
}

export async function loadProjectPresetSources(
  projectRoot: string,
): Promise<ProjectPresetSources> {
  const path = await import("node:path");
  const fs = await import("node:fs/promises");
  const protocolRoot = path.join(projectRoot, "lunatest", "presets", "protocol");
  const walletRoot = path.join(projectRoot, "lunatest", "presets", "wallet");
  const protocol: Record<string, PresetSourceInput> = {};
  const wallet: Record<string, PresetSourceInput> = {};

  try {
    await fs.access(protocolRoot);
    await readPresetDir(protocolRoot, protocol);
  } catch {
    // ignore missing local protocol preset directory
  }

  try {
    await fs.access(walletRoot);
    await readPresetDir(walletRoot, wallet);
  } catch {
    // ignore missing local wallet preset directory
  }

  return {
    protocol,
    wallet,
  };
}

export function createPresetRegistry(
  options: PresetRegistryOptions = {},
): PresetRegistry {
  return {
    protocolSources: buildSourceMap(BUILTIN_PROTOCOL_SOURCES, options.projectSources?.protocol),
    walletSources: buildSourceMap(BUILTIN_WALLET_SOURCES, options.projectSources?.wallet),
    protocolCache: new Map(),
    walletCache: new Map(),
  };
}

function getRegistry(registry?: PresetRegistry): PresetRegistry {
  if (registry) {
    return registry;
  }

  if (!defaultRegistry) {
    defaultRegistry = createPresetRegistry();
  }

  return defaultRegistry;
}

export async function listProtocolPresets(
  registry?: PresetRegistry,
): Promise<ProtocolPresetCatalogEntry[]> {
  const activeRegistry = getRegistry(registry);
  const presets = await Promise.all(
    Object.keys(activeRegistry.protocolSources).map(async (id) => {
      const preset = await loadProtocolPreset(activeRegistry, id);
      return preset?.entry ?? null;
    }),
  );

  return presets.filter((item): item is ProtocolPresetCatalogEntry => item !== null);
}

export async function getProtocolPreset(
  id: string,
  registry?: PresetRegistry,
): Promise<ProtocolPresetCatalogEntry | null> {
  const preset = await loadProtocolPreset(getRegistry(registry), id);
  return preset?.entry ?? null;
}

export async function listWalletPresets(
  registry?: PresetRegistry,
): Promise<WalletPresetCatalogEntry[]> {
  const activeRegistry = getRegistry(registry);
  const presets = await Promise.all(
    Object.keys(activeRegistry.walletSources).map(async (id) => {
      const preset = await loadWalletPreset(activeRegistry, id);
      return preset?.entry ?? null;
    }),
  );

  return presets.filter((item): item is WalletPresetCatalogEntry => item !== null);
}

export async function getWalletPreset(
  id: string,
  registry?: PresetRegistry,
): Promise<WalletPresetCatalogEntry | null> {
  const preset = await loadWalletPreset(getRegistry(registry), id);
  return preset?.entry ?? null;
}

export async function materializeWalletPreset(
  id: string,
  params: Record<string, unknown> = {},
  registry?: PresetRegistry,
): Promise<WalletPresetMaterialization> {
  const preset = await loadWalletPreset(getRegistry(registry), id);
  if (!preset) {
    throw new Error(`Wallet preset not found: ${id}`);
  }

  const resolvedParams = resolveParamDefaults(preset.entry.paramsSchema ?? [], params);
  const raw = await preset.materialize(resolvedParams);
  const rawSession = asRecord(raw.defaultSession) ?? {};
  const walletSession = createLunaWalletSession(
    deepMerge(
      preset.entry.defaultSession as Record<string, unknown>,
      rawSession,
    ),
  );

  const chainId = toChainNumber(resolvedParams.chainId ?? walletSession.chainId);
  if (chainId !== null && !preset.entry.supportedChains.includes(chainId)) {
    throw new Error(`Wallet preset ${id} does not support chain ${chainId}`);
  }

  return {
    walletPresetId: preset.entry.qualifiedId,
    resolvedParams,
    walletSession,
  };
}

export async function materializeProtocolPreset(
  id: string,
  params: Record<string, unknown> = {},
  registry?: PresetRegistry,
): Promise<ProtocolPresetMaterialization> {
  const activeRegistry = getRegistry(registry);
  const preset = await loadProtocolPreset(activeRegistry, id);
  if (!preset) {
    throw new Error(`Protocol preset not found: ${id}`);
  }

  const resolvedParams = resolveParamDefaults(preset.entry.paramsSchema, params);
  const chainId = toChainNumber(resolvedParams.chainId);
  if (chainId !== null && !preset.entry.supportedChains.includes(chainId)) {
    throw new Error(`Protocol preset ${id} does not support chain ${chainId}`);
  }

  const raw = await preset.materialize(resolvedParams);
  const walletReference =
    (asRecord(raw.walletPreset) as WalletPresetReference | null) ??
    preset.entry.defaultWalletPreset;
  const walletMaterialization = await materializeWalletPreset(
    walletReference.id,
    resolvedParams,
    activeRegistry,
  );
  const walletSession = mergeWalletReference(
    walletMaterialization.walletSession as unknown as Record<string, unknown>,
    walletReference,
    asRecord(raw.walletSessionOverrides),
  );

  return {
    protocolPresetId: preset.entry.qualifiedId,
    walletPresetId: walletMaterialization.walletPresetId,
    resolvedParams: asRecord(raw.resolvedParams) ?? resolvedParams,
    walletSession,
    interceptState: deepMerge(
      preset.entry.defaultInterceptState,
      asRecord(raw.interceptState) ?? {},
    ),
    routeMocks: [
      ...preset.entry.defaultRouteMocks,
      ...(Array.isArray(raw.routeMocks)
        ? (raw.routeMocks as ProtocolPresetMaterialization["routeMocks"])
        : []),
    ],
    builtinScenarios: Array.isArray(raw.builtinScenarios)
      ? (raw.builtinScenarios as ProtocolPresetMaterialization["builtinScenarios"])
      : preset.entry.builtinScenarios,
  };
}
