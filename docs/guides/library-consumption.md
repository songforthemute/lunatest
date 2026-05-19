# Library Consumption Guide

This guide targets teams that install LunaTest as a library inside an existing frontend project.

If you want a full 0→1 reference app (real wallet + Sepolia + Uniswap V3 + Lua chaos loop), see:

- `examples/swap-dapp`
- [Sepolia Swap Demo Guide](./swap-demo-sepolia-uniswapv3.md)

If you want to add your own team-specific protocol or wallet presets, see:

- [Protocol and Wallet Support](./protocol-support.md)
- [Local Preset Authoring Guide](./local-preset-authoring.md)

## Package Selection

- `@lunatest/core`: EIP-1193-compatible provider/runtime base
- `@lunatest/react`: React provider/hooks and adapter helpers
- `@lunatest/mcp`: MCP server, tools/resources/prompts, stdio transport
- `@lunatest/vitest-plugin`: Vitest matcher/plugin helpers
- `@lunatest/playwright-plugin`: Playwright provider injection and routing
- `@lunatest/runtime-intercept`: browser runtime intercept for local interactive testing

## Install

```bash
pnpm add @lunatest/core @lunatest/react @lunatest/mcp
pnpm add @lunatest/runtime-intercept
pnpm add -D @lunatest/vitest-plugin @lunatest/playwright-plugin
```

## Core Provider Example

```ts
import { LunaProvider } from "@lunatest/core";

const provider = new LunaProvider({
  chainId: "0x1",
  accounts: ["0x1111111111111111111111111111111111111111"],
  balances: {
    "0x1111111111111111111111111111111111111111": "0xde0b6b3a7640000",
  },
});

await provider.request({ method: "eth_chainId" });
await provider.request({ method: "eth_accounts" });
```

## Runtime Intercept Example (Local Dev Browser)

Create `lunatest.lua` in app root:

```lua
scenario {
  name = "runtime-dev",
  mode = "strict",
  given = { chain = { id = 1 }, wallet = { connected = true } },
  intercept = {
    routes = {
      { endpointType = "ethereum", method = "eth_chainId", responseKey = "wallet.chainId" },
      { endpointType = "ethereum", method = "eth_accounts", responseKey = "wallet.accounts" },
      { endpointType = "rpc", urlPattern = "**/rpc", methods = { "eth_call" }, responseKey = "rpc.call" },
      { endpointType = "http", urlPattern = "**/api/quote", method = "GET", responseKey = "api.quote" },
    },
    mockResponses = {
      ["wallet.chainId"] = { result = "0x1" },
      ["wallet.accounts"] = { result = { "0x1111111111111111111111111111111111111111" } },
      ["rpc.call"] = { result = "0x01" },
      ["api.quote"] = { status = 200, body = { amountOut = "123.45" } },
    },
    state = { chain = { blockNumber = 19000000 } },
  },
}
```

Enable once in app entry (`src/main.tsx`):

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

To use a built-in protocol runtime without hand-written protocol route mocks, pass a protocol preset id:

```ts
void bootstrapLunaRuntime({
  source: "./lunatest.lua",
  nodeEnv,
  protocolPresetId: "builtin/uniswap_v3",
  protocolPresetParams: {
    chainId: 11155111,
  },
  walletFallbackMode: "manual-toggle",
});
```

Built-in protocol presets target deterministic L3 frontend-flow support. They seed `protocolRuntime`, wallet token balances/allowances as integer base-unit strings, and runtime routes for `eth_call`, `eth_sendTransaction`, `eth_getTransactionReceipt`, and `eth_getLogs`.

Production note:

- automatic activation happens only in `development`
- to force-enable in production, pass `enable: true` or `configOverride: { enable: true }`

Activation rule:

- `enable?: boolean` is explicit override (`lunatest.lua` or config override)
- if omitted, intercept is enabled only when the resolved `nodeEnv` is `"development"`

If your browser app directly imports Lua parsing or preset registry helpers, prefer:

```ts
import { loadLunaConfig, createPresetRegistry } from "@lunatest/core/browser";
```

If you only need browser bootstrap/devtools, prefer:

```ts
import { bootstrapLunaRuntime } from "@lunatest/react/browser";
```

## React Example

```tsx
import { LunaTestProvider, useLunaTest } from "@lunatest/react";

function WalletView() {
  const { provider } = useLunaTest();
  // provider.request(...) inside your app logic
  return <div>Luna ready</div>;
}

export function App() {
  return (
    <LunaTestProvider options={{ chainId: "0x1" }}>
      <WalletView />
    </LunaTestProvider>
  );
}
```

## Adapter Example (wagmi / ethers / web3.js)

```ts
import { LunaProvider } from "@lunatest/core";
import {
  withLunaWagmiConfig,
  createEthersAdapter,
  createWeb3JsAdapter,
} from "@lunatest/react";

const provider = new LunaProvider({ chainId: "0x1" });

const wagmiConfig = withLunaWagmiConfig({ chains: [{ id: 1 }] }, provider);
const ethersLikeProvider = createEthersAdapter(provider);
const web3LikeProvider = createWeb3JsAdapter(provider);
```

## MCP stdio Example

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

## Playwright Routing Example

```ts
import { createLunaFixture } from "@lunatest/playwright-plugin";

const fixture = createLunaFixture({
  routing: {
    mode: "strict",
    rpcEndpoints: [{ urlPattern: "**/rpc", methods: ["eth_call"], responseKey: "eth_call" }],
    httpEndpoints: [{ urlPattern: "**/api/quote", method: "GET", responseKey: "quote" }],
  },
  mockResponses: {
    eth_call: { result: "0x01" },
    quote: { status: 200, body: { amountOut: "123.45" } },
  },
});
```

## Vitest Matcher Example

```ts
import { toLunaPass } from "@lunatest/vitest-plugin";

expect.extend({ toLunaPass });
expect({ pass: true }).toLunaPass();
```

## Next References

- `docs/getting-started.md`
- `docs/guides/protocol-support.md`
- `docs/guides/local-preset-authoring.md`
- `docs/guides/wagmi-setup.md`
- `docs/guides/ethers-setup.md`
- `docs/guides/web3js-setup.md`
- `docs/ko/guides/e2e-0to1.md`
