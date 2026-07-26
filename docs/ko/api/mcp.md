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

## `lunatest-mcp` 실행 파일

`@lunatest/mcp`를 설치하면 프로젝트 인식 stdio 진입점인 `lunatest-mcp` 실행 파일도 사용할 수 있습니다.

```bash
pnpm exec lunatest-mcp
```

기본 실행은 현재 작업 디렉터리의 `./lunatest.config.json`을 요구합니다. `--config <path>`는 config를 선택하고 그 파일의 디렉터리를 프로젝트 루트로 사용합니다. `--empty`는 명시적으로 비어 있는 generic 서버를 열며, `--help`는 성공적으로 종료합니다. config가 없거나 JSON으로 해석할 수 없으면 명확한 오류와 `--empty` 사용 안내를 출력합니다.

실행 파일은 서버를 만들기 전에 Lua scenario, coverage metadata/catalog, component coverage를 로드하고 preset/resource 요청에서 project-local preset을 탐색하도록 구성합니다. config에서 로드한 scenario ID는 `.lua`를 제거한 프로젝트 상대 경로이며, 예를 들면 `lunatest`, `scenarios/swap`입니다. prompt는 `prompt.list`로 사용할 수 있으며 `prompt.get`은 호출자가 전달한 `params.input`만 렌더링합니다. `scenario.create`, `scenario.mutate`는 프로세스 메모리에서만 동작하고 `scenarioDir`에 쓰지 않습니다.

완전한 프로젝트 fixture, 줄 단위 JSON-RPC 요청, 영속성 경계는 [MCP stdio 사용 가이드](../guides/mcp-stdio.md)를 보세요.

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
- `component.states(name)`는 `{ component, known, covered, missing, componentCoverage }`를 반환

`component.states(name)`는 component identity와 state coverage를 분리합니다.

```ts
type ComponentStatesResult = {
  component: string;
  known: string[];
  covered: string[];
  missing: string[];
  componentCoverage: {
    known: boolean;
    covered: boolean;
    missing: boolean;
  };
};
```

`known`, `covered`, `missing`에는 component state 이름만 들어갑니다. component 자체가 coverage catalog나 scenario metadata에 포함됐는지는 `componentCoverage`로 확인합니다.

`resource.get("lunatest://protocols")`는 `{ uri: "lunatest://protocols", content }` shape의 resource wrapper를 반환합니다. `content`는 protocol metadata 배열이며 각 item은 `id`, `label`, `source`, `kind`, `supportedChains`를 가집니다.

## 임베디드 stdio 예시

`createMcpServer`는 호스트가 전달한 option만 사용하는 임베디드 API이며 프로젝트 config를 자동으로 읽지 않습니다. config-aware 프로젝트 탐색이 필요하면 [MCP stdio 사용 가이드](../guides/mcp-stdio.md)의 `pnpm exec lunatest-mcp`를 사용하세요.

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
