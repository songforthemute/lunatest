# API: @lunatest/core

배포 채널: `latest`

## 공개 API

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

`@lunatest/core/browser`는 같은 registry/runtime 계층의 browser-safe 하위 집합을 제공합니다. `loadProjectPresetSources()`는 browser subpath가 아니라 root 패키지에서만 노출됩니다.

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

`wallet`은 provider 기본값 위에 얹는 partial wallet session입니다.

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

`createPresetRegistry(options?)`는 built-in manifest와 project-local manifest를 함께 로드합니다. `list/get/materialize` 계열은 qualified id를 사용합니다.

- built-in: `builtin/<id>`
- project-local: `project/<id>`

### Materialization shape

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

`materializeProtocolPreset()`은 resolved protocol id, 선택된 wallet preset id, merged params, 그리고 bootstrap/devtools가 쓰는 runtime payload를 함께 반환합니다. Built-in protocol preset은 `interceptState.protocolRuntime` 아래에 결정론적인 L3 frontend-flow state를 설치하고, `eth_call`, `eth_sendTransaction`, `eth_getTransactionReceipt`, `eth_getLogs` route mock을 함께 제공합니다. 정확한 EVM simulation은 범위 밖입니다.

`materializeWalletPreset()`은 resolved wallet id, merged params, session state를 반환합니다.

`validateProtocolPresetSource()`와 `validateWalletPresetSource()`는 단일 source에 대한 structured diagnostic를 돌려줍니다. `getPresetDiagnostics()`는 registry에 수집된 discovery / manifest / materialize / registry 수준 diagnostics를 반환합니다.

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

`resolveCoverageMetadata(input)`는 scenario/Lua config의 optional `coverage` metadata를 읽고, metadata가 없으면 다음 규칙으로 추론합니다.

- `when.action` -> feature coverage
- `then_ui`, `then_state`, `not_present` -> state coverage
- `then_ui` -> component coverage

`buildCoverageSnapshot({ items, coverageCatalog? })`는 명시 catalog와 items에서 발견한 covered targets를 합쳐 `known`, `coveredTargets`, `missing`, `total/covered/ratio`를 반환합니다.

## 프로젝트 scenario source

`loadLunaProjectConfig`는 working directory 또는 명시 path에서 optional `lunatest.config.json`을 비동기로 해석합니다. `loadLunaProjectConfigSync`는 Vitest watch setup처럼 동기 host configuration이 필요한 경우 같은 normalize 결과를 반환합니다. `ResolvedLunaProjectConfig` 결과에는 normalize된 `scenarioDir`, `luaConfigPath`, `coverageCatalog`, optional AI adapter 설정, `projectRoot`, resolved source path가 들어갑니다.

`resolveLunaScenarioSources`는 요청 source, glob 또는 구성된 기본 source set을 정렬되고 중복 없는 Lua file path로 확장합니다. `loadLunaProjectScenarios`는 이를 parse하여 project-relative scenario id, name, source path, parsed config, resolved coverage metadata를 반환합니다. 호출 workflow에서 빈 source set이 유효할 때만 `allowEmpty`를 사용하세요.

## 프로젝트 scenario runner

```ts
type LunaProjectRunnerOptions = {
  cwd?: string;
  configPath?: string;
  scenarioDir?: string;
};

type LunaProjectScenarioExecution = {
  scenario: LunaProjectScenario;
  execution: ExecuteLuaScenarioResult;
};

listLunaProjectScenarios(options?): Promise<LunaProjectScenario[]>;
runLunaProjectScenario({ scenarioId, adapter, ...options }): Promise<LunaProjectScenarioExecution>;
runAllLunaProjectScenarios({ createAdapter, ...options }): Promise<LunaProjectScenarioExecution[]>;
```

`listLunaProjectScenarios`는 resolved project catalog를 로드합니다. `runLunaProjectScenario`는 `scenarios/swap`처럼 정확한 project-relative id만 받으며 display name으로 대체하지 않습니다. 없는 id는 `LunaProjectScenarioNotFoundError`를 발생시킵니다.

`runLunaProjectScenario`는 구성된 source list를 parse 없이 해석한 뒤 선택한 정확한 ID만 parse합니다. 따라서 일시적으로 문법 오류인 sibling scenario가 있어도 isolated execution은 영향을 받지 않습니다. `listLunaProjectScenarios`와 `runAllLunaProjectScenarios`는 의도적으로 full catalog를 parse하며, `runAllLunaProjectScenarios`는 catalog order를 보존하고 scenario를 순차 실행하므로 하나의 browser page나 host target을 adapter가 공유해도 안전합니다. host는 명시적인 `ExecuteLuaScenarioAdapter`를 제공해야 하며 LunaTest가 UI selector나 browser action을 추론하지 않습니다.

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

## Lua config와 scenario 실행

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

`LuaConfigSchema`는 위 top-level scenario 필드와 scenario-specific passthrough 키를 허용합니다.

`executeLuaScenario(input)`는 `source`로 string, URL, parsed `LuaConfig`를 받을 수 있습니다. optional adapter는 다음 hook을 제공합니다.

- `runWhen`
- `resolveUi`
- `resolveState`
- `resolveTransitions`
- `resolveElapsedMs`

결과에는 `scenarioName`, `pass`, optional `error`, optional `result`, resolved `config`가 들어갑니다.

`createDeterministicScenarioAdapter`는 browser 없이 결정적 scenario 실행을 위한 built-in adapter입니다. scenario의 route/state data를 적용한 뒤 결과 intercept state를 UI/state resolver에 노출합니다. transition 또는 elapsed-time assertion이 필요하면 custom adapter에서 `resolveTransitions`, `resolveElapsedMs`를 제공하세요.

`applyInterceptState`, `setRouteMocks`는 `ScenarioRuntime` 변경용 convenience 함수입니다. 각 함수는 runtime instance에 위임하고 업데이트된 state 또는 route list를 반환합니다.
