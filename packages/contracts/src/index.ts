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

export type LunaWalletSession = {
  enabled: boolean;
  connected: boolean;
  chainId: string;
  accounts: string[];
  permissions: LunaWalletPermission[];
};

const DEFAULT_LUNA_WALLET_ADDRESS = "0x1111111111111111111111111111111111111111";

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
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
