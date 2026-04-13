# API: @lunatest/core

배포 채널: `latest`

## 공개 API

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

type ProtocolPresetMaterialization = {
  protocolPresetId: string;
  walletPresetId: string;
  resolvedParams: Record<string, unknown>;
  walletSession: LunaWalletSession;
  interceptState: Record<string, unknown>;
  routeMocks: RouteMock[];
  builtinScenarios: PresetScenarioDescriptor[];
};
```

`materializeProtocolPreset()`은 resolved protocol id, 선택된 wallet preset id, merged params, 그리고 bootstrap/devtools가 쓰는 runtime payload를 함께 반환합니다.

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
