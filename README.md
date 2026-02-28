# LunaTest

> Deterministic testing SDK for Web3 frontend applications.
> No chain. No fork. No flaky tests. Deterministic Web3 UI testing in milliseconds.
> Korean version: [README.ko.md](./README.ko.md)

**LunaTest** replaces slow, non-deterministic Web3 test setups (Anvil forks, MSW mocks, RPC stubs) with a lightweight Lua VM running in WebAssembly. Declare your scenario in a Lua table, inject it via an EIP-1193 compatible provider, and assert your UI — all under 1ms per test. Flaky? Zero. If a test fails, it's a bug. Period.

Package status: `Not yet published` (npm release pipeline configured, pending first stable publish).

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

## Quick Start

```bash
pnpm install --frozen-lockfile
pnpm -r build
pnpm -r lint
pnpm -r test
pnpm test:e2e:smoke
```

For nightly-scale checks:

```bash
pnpm test:e2e:extended
node scripts/check-performance.mjs --mode=absolute --threshold=5
```

## Usage Guide

1. Run workspace quality and E2E gates:

```bash
pnpm -r build
pnpm -r lint
pnpm -r test
pnpm test:e2e:smoke
```

2. Run docs locally:

```bash
pnpm docs:dev
```

3. Publish by channel:

```bash
pnpm release:publish:stable
pnpm release:publish:next
```

4. Explore API and guides:
- docs index: `docs/index.md`
- getting started: `docs/getting-started.md`
- CI and gates: `docs/guides/ci-integration.md`

## Repository Structure

| Path | Purpose |
| ---- | ------- |
| `packages/core` | Runtime, scenario engine, mock provider, runner |
| `packages/cli` | `lunatest` CLI (`run/watch/coverage/gen/devtools/doctor`) |
| `packages/react` | React provider/hooks + adapters |
| `packages/mcp` | MCP server, tools/resources/prompts, stdio transport |
| `packages/vitest-plugin` | Vitest plugin/matchers |
| `packages/playwright-plugin` | Playwright fixtures and routing helpers |
| `packages/runtime-intercept` | Browser runtime intercept for local dev interaction tests |
| `e2e-tests` | Smoke/extended end-to-end test suite |
| `docs` | VitePress documentation site |
| `examples` | Example apps and scenario files |
| `scripts` | Performance gate runner and utilities |

## Library Integration Examples

Install only what you need:

```bash
pnpm add @lunatest/core
pnpm add @lunatest/react
pnpm add @lunatest/runtime-intercept
pnpm add -D @lunatest/vitest-plugin
pnpm add @lunatest/mcp
```

### 1) Core provider (EIP-1193 compatible)

```ts
import { LunaProvider } from "@lunatest/core";

const provider = new LunaProvider({
  chainId: "0x1",
  accounts: ["0x1111111111111111111111111111111111111111"],
  balances: {
    "0x1111111111111111111111111111111111111111": "0xde0b6b3a7640000",
  },
});

const chainId = await provider.request({ method: "eth_chainId" });
```

### 2) React provider + hook

```tsx
import { LunaTestProvider, useLunaTest } from "@lunatest/react";

function WalletBadge() {
  const { provider } = useLunaTest();
  // provider.request({ method: "eth_accounts" }) ...
  return <span>Luna Provider Ready</span>;
}

export function App() {
  return (
    <LunaTestProvider options={{ chainId: "0x1" }}>
      <WalletBadge />
    </LunaTestProvider>
  );
}
```

### 3) Adapter bridge (wagmi / ethers / web3.js)

```ts
import { LunaProvider } from "@lunatest/core";
import {
  withLunaWagmiConfig,
  createEthersAdapter,
  createWeb3JsAdapter,
} from "@lunatest/react";

const provider = new LunaProvider({ chainId: "0x1" });

const wagmiConfig = withLunaWagmiConfig({ chains: [{ id: 1 }] }, provider);
const ethersLike = createEthersAdapter(provider);
const web3Like = createWeb3JsAdapter(provider);
```

### 4) MCP stdio server

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

### 5) Browser runtime intercept + in-browser devtools

`lunatest.lua` (project root):

```lua
scenario {
  name = "app-runtime",
  mode = "strict",
  given = { chain = { id = 1 }, wallet = { connected = true } },
  intercept = {
    routes = {
      { endpointType = "ethereum", method = "eth_chainId", responseKey = "wallet.chainId" },
      { endpointType = "http", urlPattern = "**/api/quote", method = "GET", responseKey = "api.quote" },
    },
    mockResponses = {
      ["wallet.chainId"] = { result = "0x1" },
      ["api.quote"] = { status = 200, body = { amountOut = "123.45" } },
    },
  },
}
```

`src/main.tsx` (one-line bootstrap + bundler-independent env detection):

```ts
import { bootstrapLunaRuntime } from "@lunatest/react";

const nodeEnv =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.MODE) ??
  (typeof process !== "undefined" ? process.env.NODE_ENV : undefined);

void bootstrapLunaRuntime({
  source: "./lunatest.lua",
  nodeEnv,
  mountDevtools: true,
});
```

### 6) Vitest matcher

```ts
import { toLunaPass } from "@lunatest/vitest-plugin";

expect.extend({ toLunaPass });
expect({ pass: true }).toLunaPass();
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

- **One-line dev bootstrap** — enable intercept in app entry, guarded by `NODE_ENV`.
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

| Package                         | Description                                              |
| ------------------------------- | -------------------------------------------------------- |
| `@lunatest/core`                | Lua runtime, mock provider, scenario engine, test runner |
| `@lunatest/cli`                 | CLI interface (`lunatest run`, `lunatest gen --ai`)      |
| `@lunatest/react`               | React hooks and test utilities                           |
| `@lunatest/mcp`                 | MCP server for AI agent integration                      |
| `@lunatest/vitest-plugin`       | Vitest integration plugin                                |
| `@lunatest/playwright-plugin`   | Playwright fixture and routing plugin                    |
| `@lunatest/runtime-intercept`   | Browser runtime intercept package                        |

### Release Channels

- `latest`: `@lunatest/contracts`, `@lunatest/core`, `@lunatest/runtime-intercept`, `@lunatest/cli`, `@lunatest/react`, `@lunatest/mcp`
- `next`: `@lunatest/vitest-plugin`, `@lunatest/playwright-plugin`

## Documentation

- Local: `pnpm docs:dev`, `pnpm docs:build`, `pnpm docs:preview`
- GitHub Pages: repository-name-aware base path is resolved in `.github/workflows/docs.yml`
  - project page: `/${repo}/`
  - user/org page: `/`
- Library consumption guide: `docs/guides/library-consumption.md`
- Korean docs index: `docs/ko/index.md`
- Korean scenario examples: `docs/ko/guides/scenario-examples.md`

## Quality and Gates

- Workspace quality: `pnpm -r build`, `pnpm -r lint`, `pnpm -r test`
- E2E smoke (PR): `pnpm test:e2e:smoke`
- E2E extended (nightly): `pnpm test:e2e:extended`
- Performance regression: `node scripts/check-performance.mjs --mode=regression`
- Performance absolute: `node scripts/check-performance.mjs --mode=absolute --threshold=5`

## Performance Policy

- PR: p95 regression gate (baseline 대비 10% 초과 시 실패)
- Nightly: absolute gate (`p95 < 1ms`, `1000 scenarios < 1s`)

## CI/CD

- PR/Push quality gate: `.github/workflows/ci.yml`
- Nightly absolute benchmark: `.github/workflows/benchmark.yml`
- Docs build/deploy: `.github/workflows/docs.yml`
- Changesets release pipeline: `.github/workflows/release.yml`
- Versioning commands:
  - `pnpm changeset`
  - `pnpm version-packages`
  - `pnpm release:publish:stable`
  - `pnpm release:publish:next`
  - `pnpm release:publish`
  - `pnpm release:publish:dry-run`

## Status

Active development. Runtime/CLI/MCP/docs/CI gates are integrated, with npm publication pending first stable release.

## License

MIT
