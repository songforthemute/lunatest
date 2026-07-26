# Runtime Intercept 0-to-1

This walkthrough connects a React application to LunaTest runtime intercept and
checks that configured wallet, HTTP, RPC, and WebSocket behavior reaches the
browser. The objective is deterministic frontend behavior, not a chain fork.

## 1. Install

```bash
pnpm add @lunatest/core @lunatest/react @lunatest/runtime-intercept
```

## 2. Define the Runtime Scenario

Create `lunatest.lua` in the application root.

```lua
scenario {
  name = "runtime-0to1",
  mode = "strict",
  given = {
    chain = { id = 1, gasPrice = 30 },
    wallet = { connected = true, balances = { ETH = 10.0 } },
  },
  intercept = {
    routes = {
      { endpointType = "ethereum", method = "eth_chainId", responseKey = "wallet.chainId" },
      { endpointType = "ethereum", method = "eth_accounts", responseKey = "wallet.accounts" },
      { endpointType = "rpc", urlPattern = "**/rpc", methods = { "eth_call" }, responseKey = "rpc.call" },
      { endpointType = "http", urlPattern = "**/api/quote", method = "GET", responseKey = "api.quote" },
      { endpointType = "ws", urlPattern = "ws://localhost:8787/stream", match = "SUBSCRIBE_QUOTE", responseKey = "ws.quote" },
    },
    mockResponses = {
      ["wallet.chainId"] = { result = "0x1" },
      ["wallet.accounts"] = { result = { "0x1111111111111111111111111111111111111111" } },
      ["rpc.call"] = { result = "0x01" },
      ["api.quote"] = { status = 200, body = { amountOut = "123.45", priceImpactBps = 12 } },
      ["ws.quote"] = { type = "QUOTE_UPDATED", payload = { amountOut = "123.40" } },
    },
  },
}
```

## 3. Bootstrap in the Application Entry

```ts
import { bootstrapLunaRuntime } from "@lunatest/react/browser";

void bootstrapLunaRuntime({
  source: "./lunatest.lua",
  nodeEnv: import.meta.env.MODE,
  mountDevtools: true,
});
```

An explicit `enable` option takes precedence. Without it, runtime intercept
enables only when the resolved `nodeEnv` is `development`. Mounting devtools is
optional; set `mountDevtools: false` when the panel is not wanted.

## 4. Verify the Contract

Call `window.ethereum.request({ method: "eth_chainId" })`, fetch the configured
HTTP route, and open the configured WebSocket from a development page or browser
test. In strict mode, an unregistered route is blocked, so route spelling,
method, and `responseKey` are the first checks when a request fails.

Move the same assertions into a browser test after the local contract is
working. For direct Playwright HTTP and JSON-RPC routing, see
[Playwright Routing](./playwright-routing.md).
