# LunaTest

> Deterministic testing SDK for Web3 frontend applications.
> No external chain or fork required for documented wallet/RPC frontend flows. Deterministic Web3 UI testing with measured evidence.
> Korean version: [README.ko.md](./README.ko.md)

**LunaTest** makes wallet- and RPC-dependent frontend flows deterministic with a lightweight Lua VM running in WebAssembly. Declare your scenario in a Lua table, inject it via an EIP-1193 compatible provider, and assert your UI. It complements Anvil, Foundry, and forked RPC tests when exact protocol behavior is required, and application-specific HTTP mocks when those boundaries are under test. The registry-certified reference journey completed 30/30 Vitest and Chromium runs with identical results and zero outbound requests.

Package status: `Published` (stable packages are available on npm).

The representative wagmi swap proof is certified against the exact npm
`latest` package set in both Vitest and Chromium; see the
[validated quickstart](./docs/guides/wagmi-swap-quickstart.md).

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

## Start in an Existing App

Install the package that matches the boundary you want to test. The smallest
provider-only setup is:

```bash
pnpm add @lunatest/core
```

For project scenario commands, install the public CLI and invoke its installed
executable:

```bash
pnpm add -D @lunatest/cli
pnpm exec lunatest validate
```

The [Getting Started guide](./docs/getting-started.md) explains package choices
and links to the runnable [Library Consumption Guide](./docs/guides/library-consumption.md)
and [CLI workflow](./docs/guides/cli-workflow.md). The examples below show the
provider, React, and integration boundaries in more detail.

## Contribute to This Repository

Repository CI uses Node 24 and pnpm 10.33.4 as its baseline. This is the
repository's CI/tooling baseline, not a claim that every published package
requires Node 24.

If your Node 24 installation includes Corepack, enable it and let the
repository's `packageManager` field select pnpm 10.33.4:

```bash
corepack enable
corepack install
```

If Corepack is unavailable or unsuitable for your environment, install the
same pnpm version by another supported means, for example:

```bash
npm install --global pnpm@10.33.4
```

Then install and run the local contributor checks:

```bash
pnpm install --frozen-lockfile
pnpm -r lint
pnpm run build
pnpm -r test
pnpm test:e2e:smoke
```

For maintainer and release checks:

```bash
pnpm lint:deadcode
pnpm pack:check-integrity
```

`pnpm test:e2e:smoke` is the local E2E command. Run it after `pnpm run build`, which serializes workspace build writers and creates the package entries it loads.

### Reproduce CI or Run Manual Benchmarks

Fresh-checkout CI jobs use their own wrapper contracts instead of the local E2E and performance commands:

```bash
pnpm lint:workspace-types
pnpm run build:workspace:ci
pnpm run lint:workspace:ci
pnpm run test:workspace:ci
pnpm lint:deadcode
pnpm pack:check-integrity
pnpm run test:e2e:smoke:ci
pnpm run perf:regression:ci
```

When manually dispatched as needed, the Benchmark workflow runs:

```bash
pnpm run test:e2e:extended:ci
pnpm run perf:absolute:ci
```

`lint:workspace-types` temporarily removes package `dist` directories before linting. The `*:ci` wrappers centralize the prebuild required when a fresh checkout has no package artifacts. They are intended for CI or for reproducing CI locally; use the local commands above for normal iteration.

The CI wrappers and performance commands are for repository maintenance or
local CI reproduction. The [CI Integration guide](./docs/guides/ci-integration.md)
documents their job graph and release policy.

### Repository Documentation and Release

Run the documentation site locally with `pnpm docs:dev`, and publish stable
packages with `pnpm release:publish:stable`. See the [documentation index](./docs/index.md)
for the guides, API references, and validated wagmi quickstart.

## Repository Structure

| Path | Purpose |
| ---- | ------- |
| `packages/core` | Runtime, scenario engine, mock provider, runner |
| `packages/cli` | `lunatest` CLI (`run/watch/coverage/gen/devtools/doctor`) |
| `packages/react` | React provider/hooks + adapters |
| `packages/mcp` | MCP server, tools/resources/prompts, stdio transport |
| `packages/vitest-plugin` | Vitest project scenario runner and matchers |
| `packages/playwright-plugin` | Playwright routing and page-bound scenario runner |
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
pnpm add -D @lunatest/vitest-plugin @lunatest/playwright-plugin
pnpm add @lunatest/mcp
```

All public LunaTest packages, including the Vitest and Playwright integrations, are published on the `latest` channel.

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

### 3) Integration boundaries (wagmi / ethers / web3.js)

**Verified integration:** wagmi and viem are verified through the real wagmi
`createConfig` transport and connector boundaries with `@wagmi/core@3.6.4` and
`viem@2.55.11`. The [validated wagmi quickstart](./docs/guides/wagmi-swap-quickstart.md)
contains the independent npm-package proof.

**Structural adapters:** `createEthersAdapter` and `createWeb3JsAdapter` only
forward their documented request surfaces to `LunaProvider.request`. They are
not ethers or Web3.js SDK integrations; create any version-specific wrapper in
the consuming application.

```ts
import { LunaProvider } from "@lunatest/core";
import { createConfig } from "@wagmi/core";
import {
  createEthersAdapter,
  createWeb3JsAdapter,
} from "@lunatest/react";
import { createLunaWagmiTransport } from "@lunatest/react/wagmi";
import { createLunaWagmiConnector } from "@lunatest/react/wagmi/connector";
import { mainnet } from "viem/chains";

const provider = new LunaProvider({ chainId: "0x1" });

const wagmiConfig = createConfig({
  batch: { multicall: false },
  chains: [mainnet],
  connectors: [createLunaWagmiConnector(provider)],
  transports: { [mainnet.id]: createLunaWagmiTransport(provider) },
});
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

### 4.5) CLI config + AI adapter

`lunatest.config.json`:

```json
{
  "scenarioDir": "scenarios",
  "luaConfigPath": "lunatest.lua",
  "coverageCatalog": {
    "features": ["swap", "approve"],
    "states": ["quoteLoaded", "approvalPending"],
    "components": ["quotePanel", "actionButtonRow"]
  },
  "ai": {
    "command": "node",
    "args": ["./adapter.mjs"]
  }
}
```

`lunatest gen --ai` sends stdin JSON with `scenarios`, `coverage`, `presetCatalog`, and `prompts`.  
The adapter must return stdout JSON array of generated scenarios, and `lunatest.config.json` must define `ai.command`. If it includes `coverage` or `tags`, LunaTest persists that metadata into the generated `.lua`.

`lunatest devtools --open` prints a project-aware guide for browser devtools bootstrap, including resolved config paths, browser entrypoint, mount API, and local preset directory.

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
import { bootstrapLunaRuntime } from "@lunatest/react/browser";

const nodeEnv =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.MODE) ??
  (typeof process !== "undefined" ? process.env.NODE_ENV : undefined);

void bootstrapLunaRuntime({
  source: "./lunatest.lua",
  nodeEnv,
  mountDevtools: true,
});
```

Production bootstrap is explicit opt-in. If you want runtime intercept outside development, pass `enable: true` or `configOverride: { enable: true }`. For browser-only bootstrap/devtools, prefer the `@lunatest/react/browser` entry.

Built-in protocol presets (`builtin/uniswap_v2`, `builtin/uniswap_v3`, `builtin/curve`, `builtin/aave`) target deterministic L3 frontend-flow support. They do not replace an exact EVM fork. See `docs/guides/protocol-support.md` for the protocol and wallet method support matrix.

For a runnable multi-protocol dogfood app that exercises those presets through public LunaTest APIs and `window.ethereum.request`, use `examples/defi-dashboard` or `docs/guides/defi-dashboard-dogfood.md`.

### 6) Vitest and Playwright scenario runners

```ts
import { createLunaVitestPlugin } from "@lunatest/vitest-plugin";

const luna = createLunaVitestPlugin({ cwd: process.cwd() });

await luna.assertScenario("scenarios/quote-ready", {
  runWhen: () => clickQuoteButton(),
  resolveUi: () => ({ quote: { status: readQuoteStatus() } }),
});
```

For a real Playwright page, bind the same project scenario to explicit host actions and DOM reads:

```ts
import { createLunaCommands, createLunaPageAdapter } from "@lunatest/playwright-plugin";

await createLunaCommands({ cwd: process.cwd() }).assertScenario(
  "scenarios/quote-ready",
  createLunaPageAdapter({
    page,
    runWhen: ({ page: target }) => target.getByTestId("load-quote").click(),
    resolveUi: async ({ page: target }) => ({
      quote: { status: await target.getByTestId("quote-status").textContent() },
    }),
  }),
);
```

Scenario IDs are exact project-relative paths. The integrations do not infer selectors or actions from Lua. `createLunaFixture().injectProvider` is deprecated and is not a wallet emulator; bootstrap `@lunatest/runtime-intercept` for deterministic wallet behavior.

## Choose the Right Test Layer

No single test tool covers every boundary. Use LunaTest only for the
documented deterministic L3 wallet/RPC frontend flows; use the layer that
matches the behavior you need to prove.

| Behavior to verify | Test layer |
| --- | --- |
| Documented deterministic L3 wallet/RPC frontend flow | LunaTest |
| Exact EVM bytecode, gas, historical state, or protocol math | Anvil, Foundry, or a forked RPC |
| Application HTTP boundary | Application-specific HTTP mocks |
| Browser visual behavior or lifecycle | The [documented browser-runner path](./docs/guides/playwright-routing.md) |

## Features

- **One-line dev bootstrap** — enable intercept in app entry, guarded by `NODE_ENV`.
- **Measured determinism** — The registry-certified reference journey produced one fingerprint across 30/30 runs per runner with zero outbound requests.
- **Measured runtime** — The certified journey recorded 6.953ms Vitest and 199.325ms Playwright medians on the pinned CI environment.
- **Precise edge cases** — Deliberate mismatches report the scenario ID, failing path, expected value, and actual value.
- **Anyone can read it** — Lua tables read like specs. QA writes scenarios, PM reviews them, git log becomes business history.
- **AI-native** — MCP server for autonomous scenario generation and coverage analysis.
- **Lua WASM runtime** — C Lua 5.4 compiled to WebAssembly via Wasmoon.

\* Registry-certified reference journey on the pinned Linux CI environment;
not a universal benchmark or flake-rate guarantee.

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

- `latest`: `@lunatest/contracts`, `@lunatest/core`, `@lunatest/runtime-intercept`, `@lunatest/cli`, `@lunatest/react`, `@lunatest/mcp`, `@lunatest/vitest-plugin`, `@lunatest/playwright-plugin`

## Documentation

- Local: `pnpm docs:dev`, `pnpm docs:build`, `pnpm docs:preview`
- GitHub Pages: repository-name-aware base path is resolved in `.github/workflows/docs.yml`
  - project page: `/${repo}/`
  - user/org page: `/`
- Library consumption guide: `docs/guides/library-consumption.md`
- Protocol and wallet support: `docs/guides/protocol-support.md`
- Korean docs index: `docs/ko/index.md`
- Korean scenario examples: `docs/ko/guides/scenario-examples.md`

## Quality and Gates

- Local workspace quality: `pnpm run build`, `pnpm -r lint`, `pnpm -r test`
- CI workspace quality: `pnpm run build:workspace:ci`, `pnpm run lint:workspace:ci`, `pnpm run test:workspace:ci`
- Dead-code gates: `pnpm lint:deadcode` for fast unused-file checks, `pnpm lint:deadcode:strict` for broader audits
- Workspace-source E2E smoke (PR): `pnpm run test:e2e:smoke:ci`
- Workspace-source E2E extended (manual Benchmark): `pnpm run test:e2e:extended:ci`
- Package entry smoke: `pnpm consumer-smoke:pack`, `pnpm consumer-smoke:npm`
- Packed tarball smoke covers every public stable package plus React 18/19 peer compatibility.
- Performance regression: `pnpm run perf:regression:ci`
- Performance absolute: `pnpm run perf:absolute:ci`

## Performance Policy

- PR: p95 regression gate (fails when p95 exceeds the baseline by more than 10%)
- Manual Benchmark: absolute gate (`p95 < 1ms`, `1000 scenarios < 1s`)

## CI/CD

- PR/Push quality gate: `.github/workflows/ci.yml`
- Manually dispatched absolute benchmark: `.github/workflows/benchmark.yml`
- Docs build/deploy: `.github/workflows/docs.yml`
- Changesets release pipeline: `.github/workflows/release.yml`
- Release auth: npm Trusted Publishing (GitHub OIDC, no long-lived publish token)
- Versioning commands:
  - `pnpm changeset`
  - `pnpm version-packages`
  - `pnpm release:publish:stable`
  - `pnpm release:publish`
  - `pnpm release:publish:dry-run`

## Status

Active development. Runtime/CLI/MCP/runner integrations/docs/CI gates are integrated, and all public packages are published on npm through `latest`.

## License

MIT
