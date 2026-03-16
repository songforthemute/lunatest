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
- `mutateMocks`, `mutateScenarioVariants`, `mutateStages`, `mutateValues`
- `parseJsonRpcLine`, `processJsonRpcLine`, `runStdioServer`

보통은 `createMcpServer`로 서버를 만든 뒤 `runStdioServer`로 연결해 사용합니다.

Preset registry 연동 도구:

- `mock.listProtocolPresets`
- `mock.getProtocolPreset`
- `mock.applyProtocolPreset`
- `mock.listWalletPresets`
- `mock.getWalletPreset`
- `mock.applyWalletPreset`
- `mock.listPresetDiagnostics`
- `mock.getPresetDiagnostic`

`mock.listPresetDiagnostics`는 잘못된 local preset를 structured diagnostic 형태로 반환합니다.
유효하지 않은 preset은 list/apply catalog에는 나타나지 않고 diagnostics에서만 확인할 수 있습니다.

## stdio 서버 예시

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

## JSON-RPC 요청 예시

```json
{"id":"1","method":"scenario.list"}
```

```json
{"id":"2","method":"scenario.run","params":{"id":"swap-smoke"}}
```
