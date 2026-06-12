# DeFi Dashboard Dogfood

`examples/defi-dashboard` is the runnable multi-protocol LunaTest dogfood app. It shows how the built-in protocol presets behave when a React app talks to the injected EIP-1193 provider instead of importing protocol internals directly.

Use this guide when you want a fast local proof that LunaTest can drive deterministic frontend flows across multiple DeFi protocols without a browser wallet, RPC key, or chain fork.

## What It Covers

| Protocol | Deterministic path exercised |
| -------- | ---------------------------- |
| Uniswap V2 | `getAmountsOut`, ERC-20 `approve`, router swap-style transaction, receipt |
| Uniswap V3 | Quoter V2 `quoteExactInputSingle`, ERC-20 `approve`, `exactInputSingle`, receipt |
| Curve | `get_dy`, ERC-20 `approve`, `exchange`, receipt |
| Aave | `getUserAccountData`, `supply`, receipt |

The app validates LunaTest **L3 frontend-flow support**. It does not claim exact EVM simulation, exact AMM math, gas behavior, forked liquidity, or historical chain state.

## Run It

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @lunatest/example-defi-dashboard dev
```

Open the Vite URL printed by the command. The example defaults to port `5175`.

## Validate It

From the repository root:

```bash
pnpm --filter @lunatest/example-defi-dashboard test
pnpm --filter @lunatest/example-defi-dashboard build
```

The tests materialize every built-in protocol preset, install runtime intercept state, execute `window.ethereum.request`, and server-render the dashboard evidence.

## Public API Path

The dogfood flow intentionally uses public package entrypoints:

```ts
const { createPresetRegistry, materializeProtocolPreset } = await import("@lunatest/core/browser");
```

```ts
import {
  applyInterceptState,
  connectWalletSession,
  enableLunaRuntimeIntercept,
  setRouteMocks,
  setWalletSession,
} from "@lunatest/runtime-intercept";
```

After each preset is materialized, the app installs the generated route mocks, intercept state, and wallet session. Protocol calls then go through `window.ethereum.request`, matching the path a frontend integration uses in development.

## When To Use This Example

| Need | Use |
| ---- | --- |
| Multi-protocol deterministic smoke coverage | `examples/defi-dashboard` |
| Real wallet + Sepolia + Uniswap V3 manual flow | `examples/swap-dapp` |
| Exact protocol bytecode, gas, forked liquidity, or liquidation math | Anvil, Foundry, or a forked RPC |

For the full support matrix, see [Protocol and Wallet Support](./protocol-support.md).
