# API: @lunatest/contracts

Release channel: `latest`

`@lunatest/contracts` is shared by the runtime, core, and integration packages. It exports both cross-package types and small runtime helpers for wallet state, preset parsing, and immutable state updates.

## Routing contracts

```ts
type RoutingMode = "strict" | "permissive";
type EndpointPattern = string | RegExp;

type RouteMock =
  | { endpointType: "ethereum"; method: string; responseKey: string }
  | { endpointType: "rpc"; urlPattern: EndpointPattern; methods?: string[]; responseKey: string }
  | { endpointType: "http"; urlPattern: EndpointPattern; method?: string; responseKey: string }
  | { endpointType: "ws"; urlPattern: EndpointPattern; responseKey: string; match?: EndpointPattern };

type RoutingConfig = {
  ethereumMethods?: EthereumMethodRoute[];
  rpcEndpoints?: RpcEndpointRoute[];
  httpEndpoints?: HttpEndpointRoute[];
  wsEndpoints?: WsEndpointRoute[];
  bypassWsPatterns?: EndpointPattern[];
};
```

Use `strict` to block unmatched configured traffic, and `permissive` to allow it through. `RouteMock.responseKey` selects a value from the host's mock response map.

## Wallet contracts

```ts
type LunaWalletSession = {
  enabled: boolean;
  connected: boolean;
  chainId: string;
  accounts: string[];
  permissions: LunaWalletPermission[];
  assets: LunaWalletAssetState;
  knownChains?: Record<string, LunaWalletChain>;
  watchedAssets?: LunaWalletWatchedAsset[];
  behavior?: LunaWalletBehavior;
};
```

`LunaWalletAssetState` stores native and token amounts as base-unit strings. `LunaWalletBehavior.userRejectedMethods` is the deterministic rejection hook used by the runtime interceptor.

## Coverage contracts

```ts
type CoverageMetadata = {
  features?: string[];
  states?: string[];
  components?: string[];
};

type CoverageCatalog = Required<CoverageMetadata>;

type CoverageSnapshot = {
  total: number;
  covered: number;
  ratio: number;
  known: CoverageCatalog;
  coveredTargets: CoverageCatalog;
  missing: CoverageCatalog;
};
```

Scenario coverage is product-level feature, state, and component coverage, not line or branch coverage.

## Runtime helpers

```ts
normalizeAddress(value: string): string;
asRecord(value: unknown): Record<string, unknown> | null;
isRecord(value: unknown): value is Record<string, unknown>;
createLunaWalletAssetState(input?: Partial<LunaWalletAssetState>): LunaWalletAssetState;
getLunaWalletTokenAsset(assets: LunaWalletAssetState, address: string): LunaWalletTokenAsset | null;
normalizeWalletPermissions(input?: Array<LunaWalletPermission | string>): LunaWalletPermission[];
createLunaWalletSession(input?: Partial<LunaWalletSession>): LunaWalletSession;
extractPermissionKeys(params?: unknown[]): string[];
deepClone<T>(value: T): T;
deepMerge(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown>;
```

`createLunaWalletSession` and `createLunaWalletAssetState` materialize complete, independent deterministic state with defaults. `deepClone` and `deepMerge` are the shared state-update primitives; neither mutates its input.

## Preset contracts

Preset manifests are represented by `ProtocolPresetManifest` and `WalletPresetManifest`. Materializing one returns `ProtocolPresetMaterialization` or `WalletPresetMaterialization`, including the resolved ids, parameters, deterministic wallet session, and applicable route/state payloads.

Use `PresetDiagnostic`, `PresetDiagnosticSeverity`, and `PresetDiagnosticPhase` when a host needs to display project-preset discovery and validation problems.

`parseProtocolPresetManifest`, `parseWalletPresetManifest`, `qualifyPresetId`, and `createPresetDiagnostic` are the corresponding runtime helpers for parsing manifests, producing qualified ids, and creating diagnostic records.
