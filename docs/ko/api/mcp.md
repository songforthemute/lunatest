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
