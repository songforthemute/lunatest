# MCP stdio 사용 가이드

`@lunatest/mcp`는 줄 단위 JSON-RPC용 `lunatest-mcp` 실행 파일을 제공합니다. 이 실행 파일은 기본적으로 프로젝트 인식 모드로 동작합니다. `lunatest.config.json`에서 LunaTest 프로젝트를 읽어 Lua 시나리오, coverage catalog, 프로젝트 preset, prompt, component/coverage tool을 같은 컨텍스트로 제공합니다.

명시적으로 넣은 seed만 사용하는 임베디드 서버는 [라이브러리 소비자 가이드](./library-consumption.md)를 보세요. 임베디드 API도 계속 지원하지만, 실행 파일처럼 프로젝트를 자동 탐색하지는 않습니다.

## 설치

서버를 실행할 프로젝트에 패키지를 설치합니다.

```bash
pnpm add -D @lunatest/mcp
```

## 최소 프로젝트

프로젝트 루트에 `lunatest.config.json`을 만듭니다.

```json
{
  "scenarioDir": "scenarios",
  "luaConfigPath": "lunatest.lua",
  "coverageCatalog": {
    "features": ["connect", "swap", "approve"],
    "states": ["walletConnected", "quoteLoaded", "approvalRequired"],
    "components": ["WalletButton", "SwapForm", "ApproveButton"]
  }
}
```

`lunatest.lua`을 만듭니다.

```lua
scenario {
  name = "wallet-ready",
  given = {},
  when = { action = "connect" },
  then_ui = {},
  coverage = {
    features = { "connect" },
    states = { "walletConnected" },
    components = { "WalletButton" },
  },
}
```

`scenarios/swap.lua`을 만듭니다.

```lua
scenario {
  name = "swap-smoke",
  given = {},
  when = { action = "swap" },
  then_ui = {},
  coverage = {
    features = { "swap" },
    states = { "quoteLoaded" },
    components = { "SwapForm" },
  },
}
```

실행 파일은 선택된 프로젝트 루트를 기준으로 `.lua` 확장자를 뺀 안정적인 ID를 만듭니다.

```text
lunatest.lua        -> lunatest
scenarios/swap.lua  -> scenarios/swap
```

## 프로젝트 인식 서버 실행

프로젝트 루트에서 설치된 실행 파일을 실행합니다.

```bash
pnpm exec lunatest-mcp
```

기본 명령은 `./lunatest.config.json`을 요구합니다. 파일이 없거나 잘못되면 시작 과정에서 명확한 오류를 출력하고, generic 서버가 정말 필요한 경우에만 `--empty`를 사용하라고 안내합니다.

사용법을 보고 성공적으로 종료하려면 `--help`를 사용합니다.

```bash
pnpm exec lunatest-mcp --help
```

현재 작업 디렉터리 밖의 config는 `--config <path>`로 선택합니다. 선택한 config 파일의 디렉터리가 프로젝트 루트가 되므로 `scenarioDir`, `luaConfigPath`, local preset 탐색은 모두 그 프로젝트 기준으로 해석됩니다.

```bash
pnpm exec lunatest-mcp --config ../swap-project/lunatest.config.json
```

프로젝트 탐색 없이 명시적으로 비어 있는 generic 서버를 열 때만 `--empty`를 사용합니다.

```bash
printf '%s\n' '{"id":"list","method":"scenario.list"}' | pnpm exec lunatest-mcp --empty
```

## JSON-RPC 요청

표준 입력에는 JSON 객체 하나를 한 줄씩 보냅니다. 아래 요청은 위 최소 프로젝트를 사용합니다.

```bash
printf '%s\n' \
  '{"id":"list","method":"scenario.list"}' \
  '{"id":"run","method":"scenario.run","params":{"id":"scenarios/swap"}}' \
  '{"id":"report","method":"coverage.report"}' \
  '{"id":"gaps","method":"coverage.gaps"}' \
  '{"id":"suggest","method":"coverage.suggest"}' \
  | pnpm exec lunatest-mcp
```

`scenario.list`에는 프로젝트 상대 ID인 `lunatest`, `scenarios/swap`이 포함됩니다. `scenario.run`은 로드된 Lua source를 실행해 `scenarios/swap` 결과를 반환합니다. 명시 catalog의 `approve`, `approvalRequired`, `ApproveButton`은 report, gaps, suggest에서 missing coverage target으로 확인할 수 있습니다.

같은 프로젝트 컨텍스트가 나머지 server surface에도 사용됩니다.

- `component.tree`, `component.states`는 component coverage를 조회합니다.
- `prompt.list`는 사용할 수 있는 prompt를 나열합니다. `prompt.get`은 호출자가 전달한 `params.input`만 렌더링하므로, prompt에 필요한 coverage 또는 component 정보는 요청에 포함해야 합니다.
- `resource.get`은 `lunatest://protocols`를 포함한 resource를 노출하며, 프로젝트 local preset은 선택된 프로젝트 루트에서 탐색합니다.

## 프로토콜 규칙

- JSON-RPC는 줄 단위입니다. 입력 한 줄은 완전한 JSON 객체 하나여야 합니다.
- `id`는 문자열, 숫자, `null`을 사용할 수 있고 응답도 그 값을 보존합니다.
- `id`가 없는 요청은 notification이며 응답을 반환하지 않습니다.
- `method`는 문자열이어야 합니다. 빈 줄, 잘못된 JSON, 유효하지 않은 payload는 error 응답을 반환합니다.

예를 들어 아래 notification은 처리되지만 응답 채널에는 아무 줄도 쓰지 않습니다.

```json
{"method":"prompt.list"}
```

## 영속성 경계

`scenario.create`, `scenario.mutate`는 실행 중인 서버의 프로세스 메모리 catalog만 바꿉니다. 같은 프로세스의 뒤이은 요청에서는 보이지만 `scenarioDir`에 Lua 파일을 쓰지 않으며, 프로세스가 종료되면 사라집니다.

`scenario.create`에 `lua`를 넣지 않으면 이후 `scenario.run`은 성공하지 않고 `scenario_lua_missing`을 반환합니다. 같은 프로세스에서 실행할 descriptor를 만들 때는 유효한 Lua를 제공해야 합니다.

## 임베디드 서버와 실행 파일의 차이

호스트 애플리케이션이 scenario descriptor와 transport stream을 직접 소유한다면 임베디드 사용 방식도 유효합니다.

```ts
import { createMcpServer, runStdioServer } from "@lunatest/mcp";

const server = createMcpServer({
  scenarios: [{ id: "swap-smoke", name: "Swap Smoke", lua: "scenario { given = {} }" }],
});

await runStdioServer({
  input: process.stdin,
  output: process.stdout,
  server,
});
```

이 임베디드 방식은 `createMcpServer`에 전달한 option만 사용합니다. consumer 프로젝트의 `lunatest.config.json`, Lua 시나리오, coverage metadata, project-local preset을 읽어야 한다면 `pnpm exec lunatest-mcp`를 사용하세요.
