# Playwright Routing

`@lunatest/playwright-plugin` creates a lightweight fixture with two explicit
operations:

- `injectProvider(target)` adds an EIP-1193-shaped test double through
  Playwright's `addInitScript` API.
- `installRouting(target)` installs HTTP and JSON-RPC route handling through
  Playwright's `route` API.

## Install

```bash
pnpm add -D @lunatest/playwright-plugin@next @playwright/test
```

## Route HTTP and JSON-RPC Requests

```ts
import { test } from "@playwright/test";
import { createLunaFixture } from "@lunatest/playwright-plugin";

const luna = createLunaFixture({
  routing: {
    mode: "strict",
    rpcEndpoints: [
      { urlPattern: "**/rpc", methods: ["eth_chainId"], responseKey: "rpc.chainId" },
      { urlPattern: "**/rpc", methods: ["eth_call"], responseKey: "rpc.call" },
    ],
    httpEndpoints: [
      { urlPattern: "**/api/quote", method: "GET", responseKey: "api.quote" },
    ],
  },
  mockResponses: {
    "rpc.chainId": { result: "0x1" },
    "rpc.call": { result: "0x01" },
    "api.quote": { status: 200, body: { amountOut: "123.45" } },
  },
});

test("loads a deterministic quote", async ({ page }) => {
  await luna.injectProvider(page);
  await luna.installRouting(page);
  await page.goto("http://localhost:3000");
});
```

In `strict` mode, a request with no matching route or mock response is aborted.
In `permissive` mode, it continues to the network. RPC routes match the
request URL and the JSON-RPC method; HTTP routes match the URL and optional
HTTP method.

The injected provider is intentionally only an EIP-1193-shaped test double.
Its `request` method throws until the application provides a handler. Use
runtime intercept when a browser test needs deterministic wallet method
responses, rather than treating `injectProvider` as a full wallet emulator.

`createLunaCommands()` is an experimental deterministic placeholder: its
`runScenario(id)` currently returns `{ id, pass: true }` and does not parse or
execute Lua scenarios.
