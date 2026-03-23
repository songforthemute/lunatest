export type RoutingMode = "strict" | "permissive";

export type EndpointPattern = string | RegExp;

export type EthereumMethodRoute = {
  method: string;
  responseKey: string;
};

export type RpcEndpointRoute = {
  urlPattern: EndpointPattern;
  methods?: string[];
  responseKey: string;
};

export type HttpEndpointRoute = {
  urlPattern: EndpointPattern;
  method?: string;
  responseKey: string;
};

export type WsEndpointRoute = {
  urlPattern: EndpointPattern;
  responseKey: string;
  match?: EndpointPattern;
};

export type RouteMock =
  | {
      endpointType: "ethereum";
      method: string;
      responseKey: string;
    }
  | {
      endpointType: "rpc";
      urlPattern: EndpointPattern;
      methods?: string[];
      responseKey: string;
    }
  | {
      endpointType: "http";
      urlPattern: EndpointPattern;
      method?: string;
      responseKey: string;
    }
  | {
      endpointType: "ws";
      urlPattern: EndpointPattern;
      responseKey: string;
      match?: EndpointPattern;
    };

export type RoutingConfig = {
  ethereumMethods?: EthereumMethodRoute[];
  rpcEndpoints?: RpcEndpointRoute[];
  httpEndpoints?: HttpEndpointRoute[];
  wsEndpoints?: WsEndpointRoute[];
  bypassWsPatterns?: EndpointPattern[];
};

export type LunaWalletPermission = {
  parentCapability: string;
};

export type LunaWalletTokenAsset = {
  balance: string;
  allowance: string;
  symbol?: string;
  decimals?: number;
};

export type LunaWalletAssetState = {
  nativeBalance: string;
  tokens: Record<string, LunaWalletTokenAsset>;
};

export type LunaWalletSession = {
  enabled: boolean;
  connected: boolean;
  chainId: string;
  accounts: string[];
  permissions: LunaWalletPermission[];
  assets: LunaWalletAssetState;
};

export type PresetKind = "dex" | "lending" | "wallet";
export type PresetSource = "builtin" | "project";
export type PresetDiagnosticSeverity = "info" | "warning" | "error";
export type PresetDiagnosticPhase = "discovery" | "manifest" | "materialize" | "registry";

export type PresetParamType =
  | "chainId"
  | "address"
  | "string"
  | "number"
  | "boolean"
  | "enum";

export type CoverageMetadata = {
  features?: string[];
  states?: string[];
  components?: string[];
};

export type CoverageCatalog = {
  features: string[];
  states: string[];
  components: string[];
};

export type CoverageSnapshot = {
  total: number;
  covered: number;
  ratio: number;
  known: CoverageCatalog;
  coveredTargets: CoverageCatalog;
  missing: CoverageCatalog;
};

export type PresetParamDescriptor = {
  key: string;
  label: string;
  type: PresetParamType;
  required?: boolean;
  default?: string | number | boolean;
  options?: Array<string | number | boolean>;
  description?: string;
};

export type PresetManifestBase = {
  id: string;
  label: string;
  description?: string;
  kind: PresetKind;
  supportedChains: number[];
};

export type PresetComponentProfile = Record<string, string>;

export type PresetScenarioDescriptor = {
  id: string;
  label: string;
  lua: string;
};

export type WalletPresetReference = {
  id: string;
  overrides?: Partial<LunaWalletSession>;
};

export type ProtocolPresetManifest = PresetManifestBase & {
  kind: Exclude<PresetKind, "wallet">;
  protocol: string;
  version: string;
  components: PresetComponentProfile;
  defaultWalletPreset: WalletPresetReference;
  defaultInterceptState: Record<string, unknown>;
  defaultRouteMocks: RouteMock[];
  builtinScenarios: PresetScenarioDescriptor[];
  paramsSchema: PresetParamDescriptor[];
  recommendedControls: string[];
};

export type WalletPresetManifest = PresetManifestBase & {
  kind: "wallet";
  defaultSession: Partial<LunaWalletSession>;
  paramsSchema?: PresetParamDescriptor[];
  recommendedControls?: string[];
};

export type WalletPresetMaterialization = {
  walletPresetId: string;
  resolvedParams: Record<string, unknown>;
  walletSession: LunaWalletSession;
};

export type ProtocolPresetMaterialization = {
  protocolPresetId: string;
  walletPresetId: string;
  resolvedParams: Record<string, unknown>;
  walletSession: LunaWalletSession;
  interceptState: Record<string, unknown>;
  routeMocks: RouteMock[];
  builtinScenarios: PresetScenarioDescriptor[];
};

export type ProtocolPresetCatalogEntry = ProtocolPresetManifest & {
  qualifiedId: string;
  source: PresetSource;
};

export type WalletPresetCatalogEntry = WalletPresetManifest & {
  qualifiedId: string;
  source: PresetSource;
};

export type PresetDiagnostic = {
  code: string;
  message: string;
  severity: PresetDiagnosticSeverity;
  phase: PresetDiagnosticPhase;
  source: PresetSource;
  qualifiedId?: string;
  path?: string;
  hint?: string;
};

const DEFAULT_LUNA_WALLET_ADDRESS = "0x1111111111111111111111111111111111111111";

export function normalizeAddress(value: string): string {
  return value.toLowerCase();
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function createLunaWalletAssetState(
  input: Partial<LunaWalletAssetState> = {},
): LunaWalletAssetState {
  return {
    nativeBalance: input.nativeBalance ?? "0",
    tokens: Object.fromEntries(
      Object.entries(input.tokens ?? {}).map(([address, asset]) => [
        normalizeAddress(address),
        {
          balance: asset.balance ?? "0",
          allowance: asset.allowance ?? "0",
          symbol: asset.symbol,
          decimals: asset.decimals,
        },
      ]),
    ),
  };
}

export function getLunaWalletTokenAsset(
  assets: LunaWalletAssetState,
  address: string,
): LunaWalletTokenAsset | null {
  return assets.tokens[normalizeAddress(address)] ?? null;
}

export function normalizeWalletPermissions(
  input?: Array<LunaWalletPermission | string>,
): LunaWalletPermission[] {
  const rawPermissions = Array.isArray(input) ? input : [];
  const permissions = rawPermissions.map((value) =>
    typeof value === "string" ? { parentCapability: value } : value,
  );

  const seen = new Set<string>();
  const normalized: LunaWalletPermission[] = [];

  for (const permission of permissions) {
    if (
      !permission ||
      typeof permission.parentCapability !== "string" ||
      permission.parentCapability.length === 0 ||
      seen.has(permission.parentCapability)
    ) {
      continue;
    }

    seen.add(permission.parentCapability);
    normalized.push({
      parentCapability: permission.parentCapability,
    });
  }

  return normalized;
}

export function createLunaWalletSession(
  input: Partial<LunaWalletSession> = {},
): LunaWalletSession {
  const accounts = input.accounts?.length
    ? [...input.accounts]
    : [DEFAULT_LUNA_WALLET_ADDRESS];
  const connected = input.connected ?? false;
  const basePermissions = normalizeWalletPermissions(input.permissions);
  const permissions = connected && !basePermissions.some((item) => item.parentCapability === "eth_accounts")
    ? normalizeWalletPermissions([...basePermissions, "eth_accounts"])
    : basePermissions;

  return {
    enabled: input.enabled ?? false,
    connected,
    chainId: input.chainId ?? "0x1",
    accounts,
    permissions,
    assets: createLunaWalletAssetState(input.assets),
  };
}

export function extractPermissionKeys(
  params?: unknown[],
): string[] {
  const [requested] = params ?? [];
  if (!requested || typeof requested !== "object") {
    return [];
  }

  return Object.keys(requested as Record<string, unknown>).filter((key) => key.length > 0);
}

function expectString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid preset field: ${field}`);
  }

  return value;
}

function expectNumberArray(value: unknown, field: string): number[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "number")) {
    throw new Error(`Invalid preset field: ${field}`);
  }

  return [...value];
}

function expectRouteMocks(value: unknown, field: string): RouteMock[] {
  if (!Array.isArray(value)) {
    const emptyRecord = asRecord(value);
    if (emptyRecord && Object.keys(emptyRecord).length === 0) {
      return [];
    }
    throw new Error(`Invalid preset field: ${field}`);
  }

  return value as RouteMock[];
}

function expectParamSchema(value: unknown, field: string): PresetParamDescriptor[] {
  const emptyRecord = asRecord(value);
  if (emptyRecord && Object.keys(emptyRecord).length === 0) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`Invalid preset field: ${field}`);
  }

  return value.map((item, index) => {
    const row = asRecord(item);
    if (!row) {
      throw new Error(`Invalid preset field: ${field}[${index}]`);
    }

    return {
      key: expectString(row.key, `${field}[${index}].key`),
      label: expectString(row.label, `${field}[${index}].label`),
      type: expectString(row.type, `${field}[${index}].type`) as PresetParamType,
      required: row.required === undefined ? undefined : Boolean(row.required),
      default:
        typeof row.default === "string" ||
        typeof row.default === "number" ||
        typeof row.default === "boolean"
          ? row.default
          : undefined,
      options: Array.isArray(row.options)
        ? row.options.filter(
            (option): option is string | number | boolean =>
              typeof option === "string" ||
              typeof option === "number" ||
              typeof option === "boolean",
          )
        : undefined,
      description: typeof row.description === "string" ? row.description : undefined,
    };
  });
}

function expectScenarioDescriptors(value: unknown, field: string): PresetScenarioDescriptor[] {
  const emptyRecord = asRecord(value);
  if (emptyRecord && Object.keys(emptyRecord).length === 0) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`Invalid preset field: ${field}`);
  }

  return value.map((item, index) => {
    const row = asRecord(item);
    if (!row) {
      throw new Error(`Invalid preset field: ${field}[${index}]`);
    }

    return {
      id: expectString(row.id, `${field}[${index}].id`),
      label: expectString(row.label, `${field}[${index}].label`),
      lua: expectString(row.lua, `${field}[${index}].lua`),
    };
  });
}

export function parseProtocolPresetManifest(value: unknown): ProtocolPresetManifest {
  const row = asRecord(value);
  if (!row) {
    throw new Error("Invalid protocol preset manifest");
  }

  const components = asRecord(row.components);
  if (!components) {
    throw new Error("Invalid preset field: components");
  }

  const defaultWalletPreset = asRecord(row.defaultWalletPreset);
  if (!defaultWalletPreset) {
    throw new Error("Invalid preset field: defaultWalletPreset");
  }

  const defaultInterceptState = asRecord(row.defaultInterceptState);
  if (!defaultInterceptState) {
    throw new Error("Invalid preset field: defaultInterceptState");
  }

  return {
    id: expectString(row.id, "id"),
    label: expectString(row.label, "label"),
    description: typeof row.description === "string" ? row.description : undefined,
    kind: expectString(row.kind, "kind") as Exclude<PresetKind, "wallet">,
    supportedChains: expectNumberArray(row.supportedChains, "supportedChains"),
    protocol: expectString(row.protocol, "protocol"),
    version: expectString(row.version, "version"),
    components: Object.fromEntries(
      Object.entries(components).map(([key, item]) => [key, expectString(item, `components.${key}`)]),
    ),
    defaultWalletPreset: {
      id: expectString(defaultWalletPreset.id, "defaultWalletPreset.id"),
      overrides: asRecord(defaultWalletPreset.overrides) as Partial<LunaWalletSession> | undefined,
    },
    defaultInterceptState,
    defaultRouteMocks: expectRouteMocks(row.defaultRouteMocks, "defaultRouteMocks"),
    builtinScenarios: expectScenarioDescriptors(row.builtinScenarios, "builtinScenarios"),
    paramsSchema: expectParamSchema(row.paramsSchema, "paramsSchema"),
    recommendedControls:
      Array.isArray(row.recommendedControls)
        ? row.recommendedControls.map((item, index) =>
            expectString(item, `recommendedControls[${index}]`),
          )
        : asRecord(row.recommendedControls) && Object.keys(asRecord(row.recommendedControls)!).length === 0
          ? []
          : [],
  };
}

export function parseWalletPresetManifest(value: unknown): WalletPresetManifest {
  const row = asRecord(value);
  if (!row) {
    throw new Error("Invalid wallet preset manifest");
  }

  const defaultSession = asRecord(row.defaultSession);
  if (!defaultSession) {
    throw new Error("Invalid preset field: defaultSession");
  }

  return {
    id: expectString(row.id, "id"),
    label: expectString(row.label, "label"),
    description: typeof row.description === "string" ? row.description : undefined,
    kind: "wallet",
    supportedChains: expectNumberArray(row.supportedChains, "supportedChains"),
    defaultSession: defaultSession as Partial<LunaWalletSession>,
    paramsSchema: row.paramsSchema ? expectParamSchema(row.paramsSchema, "paramsSchema") : undefined,
    recommendedControls:
      Array.isArray(row.recommendedControls)
        ? row.recommendedControls.map((item, index) =>
            expectString(item, `recommendedControls[${index}]`),
          )
        : asRecord(row.recommendedControls) && Object.keys(asRecord(row.recommendedControls)!).length === 0
          ? []
          : undefined,
  };
}

export function qualifyPresetId(source: PresetSource, id: string): string {
  return `${source}/${id}`;
}

export function createPresetDiagnostic(
  input: PresetDiagnostic,
): PresetDiagnostic {
  return {
    ...input,
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return asRecord(value) !== null;
}

export function deepClone<T>(value: T): T {
  if (value instanceof RegExp) {
    return new RegExp(value.source, value.flags) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item)) as T;
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, deepClone(nested)]),
    ) as T;
  }

  return value;
}

export function deepMerge(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(patch)) {
    const baseValue = next[key];
    if (isRecord(baseValue) && isRecord(value)) {
      next[key] = deepMerge(baseValue, value);
      continue;
    }

    next[key] = value;
  }

  return next;
}
