# API: @lunatest/mcp

Release channel: `latest`

## Public API

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

`createMcpServer(options)` wires together the shipped MCP tool groups and resources:

- `scenario.*` for listing, creating, running, and mutating scenarios
- `coverage.*` for coverage reporting, gap discovery, and suggestions
- `mock.*` for preset registry access and mock state routing
- `component.*` for component tree and state coverage inspection

The option bag supports both direct registry injection and project-local discovery:

- `presetRegistry`: reuse an existing registry instance
- `projectPresetSources`: inject project-local protocol/wallet sources
- `projectRoot`: load project-local sources from a filesystem root

Other options seed the exposed tools and resources:

- `scenarios`: initial scenario store
- `coverage`: fallback seed for coverage tools
- `coverageCatalog`: explicit coverage target catalog
- `mockState`: mock state seed
- `componentTree`: component tree resource seed
- `componentStates`: component coverage seed
- `protocols`: explicit protocol resource ids
- `scenarioAdapter`: execution adapter used by scenario tools

## Exported helpers

`@lunatest/mcp` also exports the tool/resource/prompt factories and transport helpers:

- `createCoverageTools`
- `createComponentTools`
- `createMockTools`
- `createScenarioTools`
- `createResourceCatalog`
- `createPromptCatalog`
- `generate`
- `mutateValues`, `mutateStages`, `mutateMocks`, `mutateScenarioVariants`
- `parseJsonRpcLine`, `processJsonRpcLine`, `runStdioServer`

## Tool / resource behavior

Preset registry tools:

- `mock.listProtocolPresets`
- `mock.getProtocolPreset`
- `mock.applyProtocolPreset`
- `mock.listWalletPresets`
- `mock.getWalletPreset`
- `mock.applyWalletPreset`
- `mock.listPresetDiagnostics`
- `mock.getPresetDiagnostic`

`mock.listPresetDiagnostics` returns structured diagnostics for malformed local presets. Invalid presets are excluded from the list/apply catalog and surfaced only through diagnostics.

Coverage / component surface:

- `coverage.report` returns `total`, `covered`, `ratio`, `known`, `coveredTargets`, `missing`
- `coverage.gaps` returns missing feature/state/component targets
- `coverage.suggest` returns scenario suggestions for missing targets
- `component.states(name)` returns `{ known, covered, missing }`

`resource.get("lunatest://protocols")` returns protocol metadata objects with `id`, `label`, `source`, `kind`, and `supportedChains`.

## Minimal stdio example

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
