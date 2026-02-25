# LunaTest

> Deterministic testing SDK for Web3 frontend applications.
> No chain. No fork. No flaky tests. Just Lua scripts and millisecond execution.

**LunaTest** replaces slow, non-deterministic Web3 test setups (Anvil forks, MSW mocks, RPC stubs) with a lightweight Lua VM running in WebAssembly. Declare your scenario in a Lua table, inject it via an EIP-1193 compatible provider, and assert your UI — all under 1ms per test. Flaky? Zero. If a test fails, it's a bug. Period.

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

|                        | Jest / Vitest | Cypress / Playwright | MSW / Mock     | Anvil / Hardhat  | Synpress         | **LunaTest**        |
| ---------------------- | ------------- | -------------------- | -------------- | ---------------- | ---------------- | ------------------- |
| Layer                  | Unit test     | E2E browser          | HTTP intercept | Local chain fork | Browser + Wallet | Lua VM mock         |
| Web3 aware             | ❌            | ❌                   | △              | ✅               | ✅               | **✅**              |
| Speed                  | ~1-5ms        | ~1-10s               | ~5-20ms        | ~1-10s           | ~10-30s          | **~0.1-1ms**        |
| Deterministic          | ✅            | △                    | ✅             | ❌               | ❌               | **✅**              |
| Flaky                  | Low           | High                 | Medium         | High             | High             | **0%**              |
| Isolates frontend bugs | ✅            | △                    | △              | △                | △                | **✅**              |
| CI cost                | Low           | Medium               | Low            | High             | High             | **Low**             |
| Human-friendly         | △ ABI noise   | ✅ visual            | △ hex fixtures | ❌ chain ops     | △ flaky          | **✅ Lua tables**   |
| AI-friendly            | △             | ❌ browser           | △              | ❌ infra         | ❌ browser       | **✅ MCP native**   |
| Non-dev participation  | ❌            | △ visual only        | ❌             | ❌               | ❌               | **✅ QA/PM/Design** |

## Features

- **Zero code change** — EIP-1193 provider swap. Works with wagmi, ethers, viem, web3.js.
- **Fully deterministic** — Sandboxed Lua VM. No timers, no system clock, no flaky. Ever.
- **Millisecond execution** — 1,000 scenarios under 1 second.
- **Precise edge cases** — Flaky 0% means every failure is a real bug. Test boundary values aggressively.
- **Anyone can read it** — Lua tables read like specs. QA writes scenarios, PM reviews them, git log becomes business history.
- **AI-native** — MCP server for autonomous scenario generation and coverage analysis.
- **~200KB runtime** — C Lua 5.4 compiled to WebAssembly via Wasmoon.

## Who is this for

| Role             | How you use LunaTest                                       |
| ---------------- | ---------------------------------------------------------- |
| **Frontend dev** | Write scenarios, run tests, ship with confidence           |
| **QA**           | Write & review scenarios directly — no more "ask a dev"    |
| **PM**           | Read given/then as living specs, track changes via git log |
| **Designer**     | Verify UI states via then_ui assertions                    |
| **Contract dev** | Contribute given state definitions for protocol presets    |

## Packages

| Package           | Description                                              |
| ----------------- | -------------------------------------------------------- |
| `@lunatest/core`  | Lua runtime, mock provider, scenario engine, test runner |
| `@lunatest/cli`   | CLI interface (`lunatest run`, `lunatest gen --ai`)      |
| `@lunatest/react` | React hooks and test utilities                           |
| `@lunatest/mcp`   | MCP server for AI agent integration                      |

## Performance Gates

- PR: p95 regression gate (baseline 대비 +10% 초과 시 실패)
- Nightly: absolute gate (`p95 < 1ms`, `1000 scenarios < 1s`)
- Runner: `node scripts/check-performance.mjs --mode=regression`

## CI/CD

- PR/Push quality gate: `.github/workflows/ci.yml`
- Nightly absolute benchmark: `.github/workflows/benchmark.yml`
- Changesets release pipeline: `.github/workflows/release.yml`
- Versioning commands:
  - `pnpm changeset`
  - `pnpm version-packages`
  - `pnpm release:publish`

## Status

Yet.

## License

MIT
