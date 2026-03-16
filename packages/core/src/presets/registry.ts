import {
  asRecord,
  createLunaWalletSession,
  createPresetDiagnostic,
  deepMerge,
  parseProtocolPresetManifest,
  parseWalletPresetManifest,
  qualifyPresetId,
  type PresetDiagnostic,
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
  protocolSources: Record<string, { source: PresetSource; input: PresetSourceInput; localId: string }>;
  walletSources: Record<string, { source: PresetSource; input: PresetSourceInput; localId: string }>;
  protocolCache: Map<string, Promise<LoadedProtocolPreset | null>>;
  walletCache: Map<string, Promise<LoadedWalletPreset | null>>;
  diagnostics: Map<string, PresetDiagnostic>;
  protocolQualifiedOwners: Map<string, string>;
  walletQualifiedOwners: Map<string, string>;
  hasProjectSources: boolean;
};

export type PresetRegistryOptions = {
  projectSources?: ProjectPresetSources;
};

export type ValidatePresetContext = {
  source: PresetSource;
  expectedId: string;
  registry?: PresetRegistry;
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

function getSourcePath(input: PresetSourceInput): string | undefined {
  if (input instanceof URL) {
    return input.toString();
  }

  if (typeof input === "string" && !input.includes("\n")) {
    return input;
  }

  return undefined;
}

function diagnosticKey(diagnostic: PresetDiagnostic): string {
  return [
    diagnostic.source,
    diagnostic.phase,
    diagnostic.code,
    diagnostic.qualifiedId ?? "none",
    diagnostic.path ?? "none",
  ].join(":");
}

function addDiagnostic(registry: PresetRegistry, diagnostic: PresetDiagnostic): void {
  registry.diagnostics.set(diagnosticKey(diagnostic), diagnostic);
}

function buildSourceMap(
  builtins: Record<string, URL>,
  project: Record<string, PresetSourceInput> | undefined,
): Record<string, { source: PresetSource; input: PresetSourceInput; localId: string }> {
  const sources: Record<string, { source: PresetSource; input: PresetSourceInput; localId: string }> = {};

  for (const [id, input] of Object.entries(builtins)) {
    sources[qualifyPresetId("builtin", id)] = {
      source: "builtin",
      input,
      localId: id,
    };
  }

  for (const [id, input] of Object.entries(project ?? {})) {
    sources[qualifyPresetId("project", id)] = {
      source: "project",
      input,
      localId: id,
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

function validateRecommendedControls(
  qualifiedId: string,
  source: PresetSource,
  path: string | undefined,
  recommendedControls: string[],
  schema: PresetParamDescriptor[],
): PresetDiagnostic[] {
  const schemaKeys = new Set(schema.map((item) => item.key));
  const diagnostics: PresetDiagnostic[] = [];

  for (const control of recommendedControls) {
    if (!schemaKeys.has(control)) {
      diagnostics.push(
        createPresetDiagnostic({
          code: "preset_recommended_control_unknown",
          message: `recommendedControls references missing param: ${control}`,
          severity: "error",
          phase: "manifest",
          source,
          qualifiedId,
          path,
          hint: "Add the key to paramsSchema or remove it from recommendedControls.",
        }),
      );
    }
  }

  return diagnostics;
}

function validateProtocolEntry(
  registry: PresetRegistry,
  entry: ProtocolPresetCatalogEntry,
  sourcePath: string | undefined,
  expectedId: string,
): PresetDiagnostic[] {
  const diagnostics = validateRecommendedControls(
    entry.qualifiedId,
    entry.source,
    sourcePath,
    entry.recommendedControls,
    entry.paramsSchema,
  );

  if (entry.id !== expectedId) {
    diagnostics.push(
      createPresetDiagnostic({
        code: "preset_id_mismatch",
        message: `manifest.id does not match discovered id: expected ${expectedId}, got ${entry.id}`,
        severity: "error",
        phase: "manifest",
        source: entry.source,
        qualifiedId: entry.qualifiedId,
        path: sourcePath,
        hint: "Match manifest.id to the file-based discovery id.",
      }),
    );
  }

  if (!resolveQualifiedId(registry, entry.defaultWalletPreset.id, "wallet")) {
    diagnostics.push(
      createPresetDiagnostic({
        code: "preset_wallet_reference_missing",
        message: `defaultWalletPreset.id not found: ${entry.defaultWalletPreset.id}`,
        severity: "error",
        phase: "manifest",
        source: entry.source,
        qualifiedId: entry.qualifiedId,
        path: sourcePath,
        hint: "Create the referenced wallet preset or point to an existing qualified id.",
      }),
    );
  }

  const existingOwner = registry.protocolQualifiedOwners.get(entry.qualifiedId);
  const owner = sourcePath ?? expectedId;
  if (existingOwner && existingOwner !== owner) {
    diagnostics.push(
      createPresetDiagnostic({
        code: "preset_duplicate_qualified_id",
        message: `duplicate protocol preset qualifiedId: ${entry.qualifiedId}`,
        severity: "error",
        phase: "registry",
        source: entry.source,
        qualifiedId: entry.qualifiedId,
        path: sourcePath,
        hint: "Rename manifest.id or change the project-local preset id.",
      }),
    );
  }

  return diagnostics;
}

function validateWalletEntry(
  registry: PresetRegistry,
  entry: WalletPresetCatalogEntry,
  sourcePath: string | undefined,
  expectedId: string,
): PresetDiagnostic[] {
  const diagnostics = validateRecommendedControls(
    entry.qualifiedId,
    entry.source,
    sourcePath,
    entry.recommendedControls ?? [],
    entry.paramsSchema ?? [],
  );

  if (entry.id !== expectedId) {
    diagnostics.push(
      createPresetDiagnostic({
        code: "preset_id_mismatch",
        message: `manifest.id does not match discovered id: expected ${expectedId}, got ${entry.id}`,
        severity: "error",
        phase: "manifest",
        source: entry.source,
        qualifiedId: entry.qualifiedId,
        path: sourcePath,
        hint: "Match manifest.id to the file-based discovery id.",
      }),
    );
  }

  const existingOwner = registry.walletQualifiedOwners.get(entry.qualifiedId);
  const owner = sourcePath ?? expectedId;
  if (existingOwner && existingOwner !== owner) {
    diagnostics.push(
      createPresetDiagnostic({
        code: "preset_duplicate_qualified_id",
        message: `duplicate wallet preset qualifiedId: ${entry.qualifiedId}`,
        severity: "error",
        phase: "registry",
        source: entry.source,
        qualifiedId: entry.qualifiedId,
        path: sourcePath,
        hint: "Rename manifest.id or change the project-local preset id.",
      }),
    );
  }

  return diagnostics;
}

export async function validateProtocolPresetSource(
  source: PresetSourceInput,
  context: ValidatePresetContext,
): Promise<{ entry: ProtocolPresetCatalogEntry | null; diagnostics: PresetDiagnostic[]; materialize?: LoadedProtocolPreset["materialize"] }> {
  const diagnostics: PresetDiagnostic[] = [];
  const path = getSourcePath(source);

  try {
    const module = await loadLuaPresetModule(source);
    const entry = toProtocolEntry(parseProtocolPresetManifest(module.manifest), context.source);
    diagnostics.push(
      ...validateProtocolEntry(
        context.registry ?? createPresetRegistry(),
        entry,
        path,
        context.expectedId,
      ),
    );

    if (diagnostics.some((item) => item.severity === "error")) {
      return { entry: null, diagnostics };
    }

    return {
      entry,
      diagnostics,
      materialize: async (params = {}) => (await module.materialize(params)) as Record<string, unknown>,
    };
  } catch (error) {
    diagnostics.push(
      createPresetDiagnostic({
        code: "preset_manifest_invalid",
        message: error instanceof Error ? error.message : String(error),
        severity: "error",
        phase: "manifest",
        source: context.source,
        qualifiedId: qualifyPresetId(context.source, context.expectedId),
        path,
        hint: "Check manifest fields and Lua syntax.",
      }),
    );

    return {
      entry: null,
      diagnostics,
    };
  }
}

export async function validateWalletPresetSource(
  source: PresetSourceInput,
  context: ValidatePresetContext,
): Promise<{ entry: WalletPresetCatalogEntry | null; diagnostics: PresetDiagnostic[]; materialize?: LoadedWalletPreset["materialize"] }> {
  const diagnostics: PresetDiagnostic[] = [];
  const path = getSourcePath(source);

  try {
    const module = await loadLuaPresetModule(source);
    const entry = toWalletEntry(parseWalletPresetManifest(module.manifest), context.source);
    diagnostics.push(
      ...validateWalletEntry(
        context.registry ?? createPresetRegistry(),
        entry,
        path,
        context.expectedId,
      ),
    );

    if (diagnostics.some((item) => item.severity === "error")) {
      return { entry: null, diagnostics };
    }

    return {
      entry,
      diagnostics,
      materialize: async (params = {}) => (await module.materialize(params)) as Record<string, unknown>,
    };
  } catch (error) {
    diagnostics.push(
      createPresetDiagnostic({
        code: "preset_manifest_invalid",
        message: error instanceof Error ? error.message : String(error),
        severity: "error",
        phase: "manifest",
        source: context.source,
        qualifiedId: qualifyPresetId(context.source, context.expectedId),
        path,
        hint: "Check manifest fields and Lua syntax.",
      }),
    );

    return {
      entry: null,
      diagnostics,
    };
  }
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
        const validated = await validateProtocolPresetSource(sourceInfo.input, {
          source: sourceInfo.source,
          expectedId: sourceInfo.localId,
          registry,
        });
        for (const diagnostic of validated.diagnostics) {
          addDiagnostic(registry, diagnostic);
        }

        if (!validated.entry || !validated.materialize) {
          return null;
        }

        registry.protocolQualifiedOwners.set(validated.entry.qualifiedId, sourceInfo.localId);
        return {
          entry: validated.entry,
          materialize: validated.materialize,
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
        const validated = await validateWalletPresetSource(sourceInfo.input, {
          source: sourceInfo.source,
          expectedId: sourceInfo.localId,
          registry,
        });
        for (const diagnostic of validated.diagnostics) {
          addDiagnostic(registry, diagnostic);
        }

        if (!validated.entry || !validated.materialize) {
          return null;
        }

        registry.walletQualifiedOwners.set(validated.entry.qualifiedId, sourceInfo.localId);
        return {
          entry: validated.entry,
          materialize: validated.materialize,
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

export function createPresetRegistry(
  options: PresetRegistryOptions = {},
): PresetRegistry {
  const registry: PresetRegistry = {
    protocolSources: buildSourceMap(BUILTIN_PROTOCOL_SOURCES, options.projectSources?.protocol),
    walletSources: buildSourceMap(BUILTIN_WALLET_SOURCES, options.projectSources?.wallet),
    protocolCache: new Map(),
    walletCache: new Map(),
    diagnostics: new Map(),
    protocolQualifiedOwners: new Map(),
    walletQualifiedOwners: new Map(),
    hasProjectSources: Boolean(
      (options.projectSources?.protocol && Object.keys(options.projectSources.protocol).length > 0) ||
      (options.projectSources?.wallet && Object.keys(options.projectSources.wallet).length > 0),
    ),
  };

  if (options.projectSources && !registry.hasProjectSources) {
    addDiagnostic(
      registry,
      createPresetDiagnostic({
        code: "local_preset_sources_empty",
        message: "No project-local preset sources were provided.",
        severity: "info",
        phase: "discovery",
        source: "project",
        hint: "Create ./lunatest/presets/protocol or ./lunatest/presets/wallet, or inject preset sources via bootstrap.",
      }),
    );
  }

  return registry;
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

async function ensureRegistryLoaded(registry: PresetRegistry): Promise<void> {
  await Promise.all([
    ...Object.keys(registry.protocolSources).map((id) => loadProtocolPreset(registry, id)),
    ...Object.keys(registry.walletSources).map((id) => loadWalletPreset(registry, id)),
  ]);
}

export async function getPresetDiagnostics(
  registry?: PresetRegistry,
): Promise<PresetDiagnostic[]> {
  const activeRegistry = getRegistry(registry);
  await ensureRegistryLoaded(activeRegistry);
  return Array.from(activeRegistry.diagnostics.values());
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
  const activeRegistry = getRegistry(registry);
  const preset = await loadWalletPreset(activeRegistry, id);
  if (!preset) {
    throw new Error(`Wallet preset not found: ${id}`);
  }

  const resolvedParams = resolveParamDefaults(preset.entry.paramsSchema ?? [], params);
  const raw = await preset.materialize(resolvedParams);
  const rawSession = asRecord(raw.defaultSession);
  if (raw.defaultSession !== undefined && !rawSession) {
    addDiagnostic(
      activeRegistry,
      createPresetDiagnostic({
        code: "preset_materialize_invalid_default_session",
        message: "wallet materialize() returned invalid defaultSession",
        severity: "error",
        phase: "materialize",
        source: preset.entry.source,
        qualifiedId: preset.entry.qualifiedId,
        hint: "Return a table for defaultSession.",
      }),
    );
    throw new Error(`Wallet preset ${id} returned invalid defaultSession`);
  }

  const walletSession = createLunaWalletSession(
    deepMerge(
      preset.entry.defaultSession as Record<string, unknown>,
      rawSession ?? {},
    ),
  );

  const chainId = toChainNumber(resolvedParams.chainId ?? walletSession.chainId);
  if (chainId !== null && !preset.entry.supportedChains.includes(chainId)) {
    addDiagnostic(
      activeRegistry,
      createPresetDiagnostic({
        code: "preset_unsupported_chain",
        message: `wallet preset does not support chain ${chainId}`,
        severity: "error",
        phase: "materialize",
        source: preset.entry.source,
        qualifiedId: preset.entry.qualifiedId,
      }),
    );
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
    addDiagnostic(
      activeRegistry,
      createPresetDiagnostic({
        code: "preset_unsupported_chain",
        message: `protocol preset does not support chain ${chainId}`,
        severity: "error",
        phase: "materialize",
        source: preset.entry.source,
        qualifiedId: preset.entry.qualifiedId,
      }),
    );
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

  if (
    raw.routeMocks !== undefined &&
    !Array.isArray(raw.routeMocks) &&
    !(asRecord(raw.routeMocks) && Object.keys(asRecord(raw.routeMocks)!).length === 0)
  ) {
    addDiagnostic(
      activeRegistry,
      createPresetDiagnostic({
        code: "preset_materialize_invalid_route_mocks",
        message: "protocol materialize() returned invalid routeMocks",
        severity: "error",
        phase: "materialize",
        source: preset.entry.source,
        qualifiedId: preset.entry.qualifiedId,
        hint: "Return an array of route mocks or an empty table.",
      }),
    );
    throw new Error(`Protocol preset ${id} returned invalid routeMocks`);
  }

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
