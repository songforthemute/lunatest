# API: @lunatest/mcp

배포 채널: `latest`

## 공개 API

- `createMcpServer`
- `createCoverageTools`
- `createComponentTools`
- `createMockTools`
- `createScenarioTools`
- `createResourceCatalog`
- `createPromptCatalog`
- `generate`
- `mutateValues`
- `mutateStages`
- `mutateMocks`
- `mutateScenarioVariants`
- `parseJsonRpcLine`
- `processJsonRpcLine`
- `runStdioServer`

## `createMcpServer(options)`

```ts
type McpServerOptions = {
  scenarios?: ScenarioDescriptor[];
  coverage?: {
    total?: number;
    covered?: number;
    ratio?: number;
  };
  coverageCatalog?: Partial<CoverageCatalog>;
  mockState?: Record<string, unknown>;
  componentTree?: Array<{ name: string; children?: Array<{ name: string }> }>;
  componentStates?: Record<string, string[]>;
  protocols?: string[];
  scenarioAdapter?: ExecuteLuaScenarioInput["adapter"];
  presetRegistry?: PresetRegistry;
  projectPresetSources?: ProjectPresetSources;
  projectRoot?: string;
};
```

`createMcpServer(options)`는 shipped MCP tool group과 resource를 묶어서 서버를 구성합니다.

- `scenario.*`: 시나리오 listing / creation / execution / mutation
- `coverage.*`: coverage report / gap discovery / suggestion
- `mock.*`: preset registry 접근 / mock state routing
- `component.*`: component tree / state coverage 조회

옵션 bag은 registry 주입과 project-local discovery 둘 다 지원합니다.

- `presetRegistry`: 이미 만들어 둔 registry 재사용
- `projectPresetSources`: project-local protocol/wallet source 주입
- `projectRoot`: filesystem root에서 project-local source 로드

그 외 옵션은 노출되는 tool/resource의 seed로 사용됩니다.

- `scenarios`: 초기 scenario store
- `coverage`: coverage tool fallback seed
- `coverageCatalog`: 명시 coverage target catalog
- `mockState`: mock state seed
- `componentTree`: component tree resource seed
- `componentStates`: component coverage seed
- `protocols`: protocol resource id override
- `scenarioAdapter`: scenario tool execution adapter

## Exported helper

`@lunatest/mcp`는 tool/resource/prompt factory와 transport helper도 같이 export합니다.

- `createCoverageTools`
- `createComponentTools`
- `createMockTools`
- `createScenarioTools`
- `createResourceCatalog`
- `createPromptCatalog`
- `generate`
- `mutateValues`, `mutateStages`, `mutateMocks`, `mutateScenarioVariants`
- `parseJsonRpcLine`, `processJsonRpcLine`, `runStdioServer`

## tool / resource behavior

Preset registry tools:

- `mock.listProtocolPresets`
- `mock.getProtocolPreset`
- `mock.applyProtocolPreset`
- `mock.listWalletPresets`
- `mock.getWalletPreset`
- `mock.applyWalletPreset`
- `mock.listPresetDiagnostics`
- `mock.getPresetDiagnostic`

`mock.listPresetDiagnostics`는 malformed local preset를 structured diagnostic로 반환합니다. invalid preset은 list/apply catalog에는 들어가지 않고 diagnostics로만 노출됩니다.

Coverage / component surface:

- `coverage.report`는 `total`, `covered`, `ratio`, `known`, `coveredTargets`, `missing`를 반환
- `coverage.gaps`는 missing feature/state/component target 목록을 반환
- `coverage.suggest`는 missing target 기준 scenario suggestion을 반환
- `component.states(name)`는 `{ known, covered, missing }`를 반환

`resource.get("lunatest://protocols")`는 protocol id 배열이 아니라 `id`, `label`, `source`, `kind`, `supportedChains`를 가진 metadata object 배열을 반환합니다.

## 최소 stdio 예시

```ts
import { createMcpServer, runStdioServer } from "@lunatest/mcp";

const server = createMcpServer({
  scenarios: [{ id: "swap-smoke", name: "Swap Smoke", lua: "scenario {}" }],
});

await runStdioServer({
  input: process.stdin,
  output: process.stdout,
  server,
});
```
