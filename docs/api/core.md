# API: @lunatest/core

Release channel: `latest`

## Public API

- `LunaProvider`
- `LunaProviderOptions`
- `createPresetRegistry(options?)`
- `loadProjectPresetSources(projectRoot)`
- `loadLunaConfig(source)`
- `loadLunaProjectConfig`
- `loadLunaProjectConfigSync`
- `loadLunaProjectScenarios`
- `resolveLunaScenarioSources`
- `listLunaProjectScenarios(options?)`
- `runLunaProjectScenario(options)`
- `runAllLunaProjectScenarios`
- `LunaProjectScenarioNotFoundError`
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
- `applyInterceptState`
- `setRouteMocks`
- `LuaConfigSchema`
- `createDeterministicScenarioAdapter`
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

## Project scenario sources

`loadLunaProjectConfig` resolves an optional `lunatest.config.json` asynchronously from a working directory or explicit path. `loadLunaProjectConfigSync` returns the identical normalized result for synchronous host-configuration integration such as Vitest watch setup. Its `ResolvedLunaProjectConfig` result includes the normalized `scenarioDir`, `luaConfigPath`, `coverageCatalog`, optional AI adapter configuration, `projectRoot`, and resolved source paths.

`resolveLunaScenarioSources` expands a requested source, glob, or the configured default source set into sorted, unique Lua file paths. `loadLunaProjectScenarios` parses those files and returns project-relative scenario ids, names, source paths, a `sha256:`-prefixed `sourceDigest` of the exact UTF-8 Lua source, parsed configs, and resolved coverage metadata. Use `allowEmpty` only when an empty source set is valid for the calling workflow.

## Project scenario runner

```ts
type LunaProjectRunnerOptions = {
  cwd?: string;
  configPath?: string;
  scenarioDir?: string;
};

type LunaProjectScenario = {
  id: string;
  name: string;
  source: string;
  sourceDigest: `sha256:${string}`;
  lua: string;
  config: LuaConfig;
  coverage: CoverageMetadata;
};

type LunaProjectScenarioExecution = {
  scenario: LunaProjectScenario;
  execution: ExecuteLuaScenarioResult;
};

listLunaProjectScenarios(options?): Promise<LunaProjectScenario[]>;
runLunaProjectScenario({ scenarioId, adapter, ...options }): Promise<LunaProjectScenarioExecution>;
runAllLunaProjectScenarios({ createAdapter, ...options }): Promise<LunaProjectScenarioExecution[]>;
```

`listLunaProjectScenarios` loads the resolved project catalog. `runLunaProjectScenario` accepts only an exact project-relative id such as `scenarios/swap`; it does not fall back to a display name. An unknown id throws `LunaProjectScenarioNotFoundError`.

`runLunaProjectScenario` resolves the configured source list without parsing it, then parses only the selected exact ID. This keeps an isolated execution independent from a temporarily malformed sibling scenario. `listLunaProjectScenarios` and `runAllLunaProjectScenarios` intentionally parse the full catalog; `runAllLunaProjectScenarios` preserves catalog order and executes scenarios sequentially, so an adapter may safely bind a shared browser page or host target. The host supplies an explicit `ExecuteLuaScenarioAdapter`: LunaTest does not infer UI selectors or browser actions.

```ts
import { runLunaProjectScenario } from "@lunatest/core";

const result = await runLunaProjectScenario({
  cwd: process.cwd(),
  scenarioId: "scenarios/quote-ready",
  adapter: {
    runWhen: () => clickQuoteButton(),
    resolveUi: () => ({ quote: { status: readQuoteStatus() } }),
  },
});

if (!result.execution.pass) throw new Error(result.execution.error);
```

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
  stages?: Array<{ name: string; on?: string }>;
  not_present?: string[];
  timing_ms?: number;
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

`createDeterministicScenarioAdapter` is the built-in adapter for deterministic scenario execution. It applies the scenario's route and state data without a browser, then exposes the resulting intercept state to the UI and state resolvers. Supply `resolveTransitions` or `resolveElapsedMs` in a custom adapter when the scenario needs those assertions.

`applyInterceptState` and `setRouteMocks` are convenience functions for mutating a `ScenarioRuntime`; each delegates to the runtime instance and returns the updated state or route list.
