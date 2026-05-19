# API: @lunatest/core

Release channel: `latest`

## Public API

- `LunaProvider`
- `LunaProviderOptions`
- `createPresetRegistry(options?)`
- `loadProjectPresetSources(projectRoot)`
- `loadLunaConfig(source)`
- `listProtocolPresets(registry?)`
- `getProtocolPreset(id, registry?)`
- `materializeProtocolPreset(id, params?, registry?)`
- `validateProtocolPresetSource(source, context?)`
- `listWalletPresets(registry?)`
- `getWalletPreset(id, registry?)`
- `materializeWalletPreset(id, params?, registry?)`
- `validateWalletPresetSource(source, context?)`
- `getPresetDiagnostics(registry?)`
- `buildCoverageSnapshot(input)`
- `resolveCoverageMetadata(input)`
- `createScenarioRuntime(config)`
- `LuaConfigSchema`
- `executeLuaScenario(input)`
- `RouteMock`

`@lunatest/core/browser` exports the browser-safe subset of the same registry/runtime helpers. `loadProjectPresetSources()` is available only from the root package, not from the browser subpath.

## `LunaProviderOptions`

```ts
type LunaProviderOptions = {
  chainId?: string;
  accounts?: string[];
  balances?: Record<string, string>;
  wallet?: Partial<LunaWalletSession>;
  callHandler?: (input: Record<string, unknown>) => Promise<string> | string;
};
```

`wallet` lets you seed a partial wallet session on top of the provider defaults.

## Preset registry

```ts
type ProjectPresetSources = {
  protocol?: Record<string, string | URL>;
  wallet?: Record<string, string | URL>;
};

type PresetRegistryOptions = {
  projectSources?: ProjectPresetSources;
};
```

`createPresetRegistry(options?)` merges built-in manifest sources with optional project-local sources. `list/get/materialize` functions always work with qualified ids:

- built-in: `builtin/<id>`
- project-local: `project/<id>`

### Materialization shapes

```ts
type WalletPresetMaterialization = {
  walletPresetId: string;
  resolvedParams: Record<string, unknown>;
  walletSession: LunaWalletSession;
};

type ProtocolRuntimeState = {
  activeProtocol: "uniswap_v2" | "uniswap_v3" | "curve" | "aave";
  supportLevel: "L3";
  chainId: number;
  contracts: Record<string, string>;
  tokens: Record<string, { symbol?: string; decimals?: number }>;
  transactionBehavior?: {
    forcePending?: boolean;
    forceRevert?: boolean;
    userRejectedMethods?: string[];
  };
  uniswapV2?: unknown;
  uniswapV3?: unknown;
  curve?: unknown;
  aave?: unknown;
};

type ProtocolPresetMaterialization = {
  protocolPresetId: string;
  walletPresetId: string;
  resolvedParams: Record<string, unknown>;
  walletSession: LunaWalletSession;
  interceptState: Record<string, unknown> & {
    protocolRuntime?: ProtocolRuntimeState;
  };
  routeMocks: RouteMock[];
  builtinScenarios: PresetScenarioDescriptor[];
};
```

`materializeProtocolPreset()` always returns the resolved protocol id, the wallet preset it selected, the merged params, and the runtime payloads used by bootstrap/devtools. Built-in protocol presets install deterministic L3 frontend-flow state under `interceptState.protocolRuntime` plus route mocks for `eth_call`, `eth_sendTransaction`, `eth_getTransactionReceipt`, and `eth_getLogs`. Exact EVM simulation remains out of scope.

`materializeWalletPreset()` always returns the resolved wallet id, the merged params, and the session state.

`validateProtocolPresetSource()` and `validateWalletPresetSource()` return structured diagnostics for a single source. `getPresetDiagnostics()` returns the diagnostics collected in a registry, including discovery, manifest, materialize, and registry-level issues.

## Coverage helpers

```ts
type CoverageCatalog = {
  features: string[];
  states: string[];
  components: string[];
};

type CoverageSnapshot = {
  total: number;
  covered: number;
  ratio: number;
  known: CoverageCatalog;
  coveredTargets: CoverageCatalog;
  missing: CoverageCatalog;
};
```

`resolveCoverageMetadata(input)` reads optional `coverage` metadata from a scenario/Lua config and falls back to inference when the metadata is absent:

- `when.action` -> feature coverage
- `then_ui`, `then_state`, `not_present` -> state coverage
- `then_ui` -> component coverage

`buildCoverageSnapshot({ items, coverageCatalog? })` merges known coverage targets from the explicit catalog and the covered targets discovered from the items. It returns `known`, `coveredTargets`, `missing`, and aggregate `total/covered/ratio` values.

## Lua config and scenario execution

```ts
const LuaConfigSchema: z.ZodType<LuaConfig>;

type LuaConfig = {
  name?: string;
  mode: "strict" | "permissive";
  given: Record<string, unknown>;
  when?: Record<string, unknown>;
  then_ui?: Record<string, unknown>;
  then_state?: Record<string, unknown>;
  not_present?: string[];
  coverage?: CoverageMetadata;
  intercept?: {
    routes?: RouteMock[];
    routing?: unknown;
    mockResponses?: Record<string, unknown>;
    state?: Record<string, unknown>;
  };
};
```

`LuaConfigSchema` accepts the top-level scenario fields above plus passthrough keys for scenario-specific metadata.

`executeLuaScenario(input)` accepts `source` as a string, URL, or parsed `LuaConfig`. The optional adapter may provide:

- `runWhen`
- `resolveUi`
- `resolveState`
- `resolveTransitions`
- `resolveElapsedMs`

The result includes `scenarioName`, `pass`, optional `error`, optional `result`, and the resolved `config`.
