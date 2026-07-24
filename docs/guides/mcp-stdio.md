# MCP stdio Guide

`@lunatest/mcp` exposes the `lunatest-mcp` executable for line-delimited JSON-RPC. Unlike an embedded server, the executable is project-aware by default: it reads the LunaTest project selected by `lunatest.config.json` and serves its Lua scenarios, coverage catalog, project presets, prompts, and component/coverage tools.

For an embedded server with explicitly supplied seeds, see [Library Consumption](./library-consumption.md). That API remains valid, but it does not perform the executable's project discovery.

## Install

Install the package in the project that will run the server:

```bash
pnpm add -D @lunatest/mcp
```

## Minimal project

Create `lunatest.config.json` at the project root:

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

Create `lunatest.lua`:

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

Create `scenarios/swap.lua`:

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

The executable creates stable IDs relative to the selected project root, with the `.lua` suffix removed:

```text
lunatest.lua        -> lunatest
scenarios/swap.lua  -> scenarios/swap
```

## Start the project-aware server

Run the installed executable from the project root:

```bash
pnpm exec lunatest-mcp
```

The default command requires `./lunatest.config.json`. If that file is missing or cannot be parsed as JSON, startup writes a clear error and includes guidance to use `--empty` only when a generic server is intentional.

Use `--help` to print usage and exit successfully:

```bash
pnpm exec lunatest-mcp --help
```

Use a config outside the current working directory with `--config <path>`. The selected config file's directory becomes the project root, so its `scenarioDir`, `luaConfigPath`, and local preset discovery remain relative to that project:

```bash
pnpm exec lunatest-mcp --config ../swap-project/lunatest.config.json
```

Use `--empty` only for an explicit generic server with no project discovery:

```bash
printf '%s\n' '{"id":"list","method":"scenario.list"}' | pnpm exec lunatest-mcp --empty
```

## JSON-RPC requests

Send one JSON object per line on standard input. The following requests use the minimal project above:

```bash
printf '%s\n' \
  '{"id":"list","method":"scenario.list"}' \
  '{"id":"run","method":"scenario.run","params":{"id":"scenarios/swap"}}' \
  '{"id":"report","method":"coverage.report"}' \
  '{"id":"gaps","method":"coverage.gaps"}' \
  '{"id":"suggest","method":"coverage.suggest"}' \
  | pnpm exec lunatest-mcp
```

`scenario.list` includes the project-relative IDs `lunatest` and `scenarios/swap`. `scenario.run` receives the loaded Lua source and returns a result for `scenarios/swap`. The explicit catalog makes `approve`, `approvalRequired`, and `ApproveButton` visible as missing coverage targets in the report, gaps, and suggestions.

The same project context feeds the rest of the server surface:

- `component.tree` and `component.states` inspect component coverage.
- `prompt.list` lists the available prompts. `prompt.get` renders only caller-provided `params.input`; include any coverage or component details needed by that prompt in the request.
- `resource.get` exposes resources, including `lunatest://protocols`; project-local preset discovery uses the selected project root.

## Protocol rules

- JSON-RPC is line delimited: one complete JSON object per input line.
- `id` may be a string, number, or `null`; the response preserves that value.
- A request without `id` is a notification and produces no response.
- `method` must be a string. Empty, malformed, or invalid payloads produce an error response.

For example, this notification updates no response channel even though the server processes it:

```json
{"method":"prompt.list"}
```

## Persistence boundary

`scenario.create` and `scenario.mutate` update only the running server's process-memory catalog. They are available to later requests in the same process, but they do not write a Lua file to `scenarioDir` and are lost when the process exits.

If a created descriptor has no `lua` field, `scenario.run` returns `scenario_lua_missing`. Provide valid Lua when creating a descriptor that must be run in the current process.

## Embedded server versus executable

Embedded usage remains appropriate when the host application owns the scenario descriptors and transport streams:

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

This embedded form uses only the options passed to `createMcpServer`. Use `pnpm exec lunatest-mcp` when the server should load `lunatest.config.json`, Lua scenarios, coverage metadata, and project-local presets from a consumer project.
