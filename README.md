# LunaTest

> Deterministic testing SDK for Web3 frontend applications.
> No chain. No fork. No flaky tests. Just Lua scripts and millisecond execution.

**LunaTest** replaces slow, non-deterministic Web3 test setups (Anvil forks, MSW mocks, RPC stubs) with a lightweight Lua VM running in WebAssembly. Declare your scenario in a Lua table, inject it via an EIP-1193 compatible provider, and assert your UI — all under 1ms per test.

```lua
scenario {
  name = "high_slippage_warning",

  given = {
    pool   = { pair = "ETH/USDC", reserve0 = 100, reserve1 = 180000, fee = 3000 },
    wallet = { connected = true, ETH = 10.5 },
  },

  when = { action = "swap", input = { tokenIn = "ETH", amount = 50 } },

  then_ui = { warning = true, severity = "high", slippage_label = "> 10%" },
}
```

## Why

|                        | Jest / Vitest | Cypress / Playwright | MSW / Mock     | Anvil / Hardhat  | Synpress         | **LunaTest**      |
| ---------------------- | ------------- | -------------------- | -------------- | ---------------- | ---------------- | ----------------- |
| Layer                  | Unit test     | E2E browser          | HTTP intercept | Local chain fork | Browser + Wallet | Lua VM mock       |
| Web3 aware             | ❌            | ❌                   | △              | ✅               | ✅               | **✅**            |
| Speed                  | ~1-5ms        | ~1-10s               | ~5-20ms        | ~1-10s           | ~10-30s          | **~0.1-1ms**      |
| Deterministic          | ✅            | △                    | ✅             | ❌               | ❌               | **✅**            |
| Isolates frontend bugs | ✅            | △                    | △              | △                | △                | **✅**            |
| CI cost                | Low           | Medium               | Low            | High             | High             | **Low**           |
| Human-friendly         | △ ABI noise   | ✅ visual            | △ hex fixtures | ❌ chain ops     | △ flaky          | **✅ Lua tables** |
| AI-friendly            | △             | ❌ browser           | △              | ❌ infra         | ❌ browser       | **✅ MCP native** |

## Features

- **Zero code change** — EIP-1193 provider swap. Works with wagmi, ethers, viem, web3.js.
- **Fully deterministic** — Sandboxed Lua VM. No timers, no system clock, no flaky.
- **Millisecond execution** — 1,000 scenarios under 1 second.
- **AI-native** — MCP server for autonomous scenario generation and coverage analysis.
- **~200KB runtime** — C Lua 5.4 compiled to WebAssembly via Wasmoon.

## Packages

| Package           | Description                                              |
| ----------------- | -------------------------------------------------------- |
| `@lunatest/core`  | Lua runtime, mock provider, scenario engine, test runner |
| `@lunatest/cli`   | CLI interface (`lunatest run`, `lunatest gen --ai`)      |
| `@lunatest/react` | React hooks and test utilities                           |
| `@lunatest/mcp`   | MCP server for AI agent integration                      |

## Status

Yet.

## License

MIT
