# Library Consumption Guide

LunaTest can be consumed by package role. Install only the layers you need.

## Package Selection

- `@lunatest/core`: EIP-1193-compatible provider/runtime base
- `@lunatest/react`: React provider/hooks and adapter helpers
- `@lunatest/mcp`: MCP server, tools/resources/prompts, stdio transport
- `@lunatest/vitest-plugin`: Vitest matcher/plugin helpers
- `@lunatest/playwright-plugin`: Playwright provider injection and routing

## Install

```bash
pnpm add @lunatest/core @lunatest/react @lunatest/mcp
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
- `docs/guides/wagmi-setup.md`
- `docs/guides/ethers-setup.md`
- `docs/guides/web3js-setup.md`
