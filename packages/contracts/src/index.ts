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
  const permissions = (input ?? []).map((value) =>
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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return asRecord(value) !== null;
}

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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
