# Playwright Routing

`@lunatest/playwright-plugin` creates a lightweight fixture with two explicit
operations:

- `injectProvider(target)` adds an EIP-1193-shaped test double through
  Playwright's `addInitScript` API. It is deprecated and not a wallet emulator.
- `installRouting(target)` installs HTTP and JSON-RPC route handling through
  Playwright's `route` API.

## Install

```bash
pnpm add -D @lunatest/playwright-plugin @playwright/test
```

## Route HTTP and JSON-RPC Requests

```ts
import { expect, test } from "@playwright/test";
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

## Execute a Lua Scenario Against a Page

`createLunaCommands` loads a `lunatest.config.json` project and resolves exact
project-relative IDs. `createLunaPageAdapter` runs the host action and reads
real page state through explicit callbacks.

```ts
import { createLunaCommands, createLunaPageAdapter } from "@lunatest/playwright-plugin";

const commands = createLunaCommands({ cwd: process.cwd() });

test("verifies quote-ready", async ({ page }) => {
  await page.goto("http://localhost:3000");

  const execution = await commands.assertScenario(
    "scenarios/quote-ready",
    createLunaPageAdapter({
      page,
      runWhen: ({ page: target }) => target.getByTestId("load-quote").click(),
      resolveUi: async ({ page: target }) => ({
        quote: { status: await target.getByTestId("quote-status").textContent() },
      }),
    }),
  );

  expect(execution.execution.pass).toBe(true);
});
```

The adapter first applies deterministic scenario state, then invokes `runWhen`.
LunaTest never derives selectors or browser actions from the Lua `when` field.
