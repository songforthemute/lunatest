# API: @lunatest/contracts

배포 채널: `latest`

`@lunatest/contracts`는 runtime, core, integration 패키지가 공유합니다. cross-package type뿐 아니라 wallet state, preset parsing, immutable state update용 작은 runtime helper도 export합니다.

## 라우팅 계약

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

`strict`는 설정되지 않은 트래픽을 막고, `permissive`는 통과시킵니다. `RouteMock.responseKey`는 호스트 mock response map의 값을 선택합니다.

## 지갑 계약

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

`LunaWalletAssetState`의 native/token amount는 base-unit string입니다. `LunaWalletBehavior.userRejectedMethods`는 runtime interceptor가 사용하는 결정적 거부 hook입니다.

## Coverage 계약

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

scenario coverage는 line/branch coverage가 아니라 product-level feature, state, component coverage입니다.

## Runtime helper

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

`createLunaWalletSession`, `createLunaWalletAssetState`는 default가 적용된 독립적인 deterministic state를 materialize합니다. `deepClone`, `deepMerge`는 input을 변경하지 않는 공유 state-update primitive입니다.

## Preset 계약

Preset manifest는 `ProtocolPresetManifest`, `WalletPresetManifest`로 표현합니다. materialize 결과인 `ProtocolPresetMaterialization`, `WalletPresetMaterialization`에는 resolved id, parameter, deterministic wallet session, route/state payload가 들어갑니다.

프로젝트 preset discovery와 validation 문제를 표시하려면 `PresetDiagnostic`, `PresetDiagnosticSeverity`, `PresetDiagnosticPhase`를 사용합니다.

`parseProtocolPresetManifest`, `parseWalletPresetManifest`, `qualifyPresetId`, `createPresetDiagnostic`은 manifest parse, qualified id 생성, diagnostic record 생성을 위한 runtime helper입니다.
