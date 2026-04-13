# API: @lunatest/runtime-intercept

Release channel: `latest`

`@lunatest/runtime-intercept` is the browser runtime layer for local interactive testing.

## Public API

- `enableLunaRuntimeIntercept(config, nodeEnv?)`
- `disableLunaRuntimeIntercept()`
- `createLunaRuntimeIntercept(config)`
- `setRouteMocks(routes)`
- `appendRouteMocks(routes)`
- `applyInterceptState(partialState)`
- `getInterceptState()`
- `setWalletSession(session)`
- `getWalletSession()`
- `connectWalletSession(address?)`
- `disconnectWalletSession()`
- `isLunaRuntimeInterceptEnabled()`
- `resolveEnabled(config, nodeEnv?)`
- `normalizeRuntimeInterceptConfig(input)`
- `LunaRuntimeInterceptConfig`
- `NormalizedRuntimeInterceptConfig`
- `RuntimeInterceptHandle`

## `LunaRuntimeInterceptConfig`

```ts
type LunaRuntimeInterceptConfig = {
  enable?: boolean;
  debug?: boolean;
  wallet?: {
    session?: Partial<LunaWalletSession>;
  };
  intercept?: {
    mode?: "strict" | "permissive";
    routes?: RouteMock[];
    routing?: RoutingConfig;
    mockResponses?: Record<string, unknown | ((ctx) => unknown | Promise<unknown>)>;
  };
};
```

`wallet.session` is the public config hook for seeding wallet state before the intercept runtime becomes active.

## `normalizeRuntimeInterceptConfig(input)`

`normalizeRuntimeInterceptConfig()` resolves the runtime config into a normalized object with:

- `wallet.session` materialized as a full `LunaWalletSession`
- `intercept.mode` defaulted to `strict` when omitted
- `intercept.routing` converted to arrays even when the input used legacy route lists
- `intercept.mockResponses` cloned into a plain record

## Activation priority

1. An explicit boolean `enable` wins.
2. Otherwise, activation happens only when the resolved environment is `development`.

## Wallet session helpers

These helpers operate on the active runtime handle:

- `setWalletSession(session)` updates the active wallet session and returns the normalized session.
- `getWalletSession()` returns the current session.
- `connectWalletSession(address?)` marks the session connected and optionally seeds a single address.
- `disconnectWalletSession()` marks the session disconnected.

## Minimal example

```ts
import { loadLunaConfig } from "@lunatest/core";
import {
  enableLunaRuntimeIntercept,
  setRouteMocks,
  applyInterceptState,
} from "@lunatest/runtime-intercept";

const config = await loadLunaConfig("./lunatest.lua");
const nodeEnv =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.MODE) ??
  (typeof process !== "undefined" ? process.env.NODE_ENV : undefined);

const enabled = enableLunaRuntimeIntercept(
  {
    wallet: {
      session: config.intercept?.state?.walletSession as Partial<LunaWalletSession> | undefined,
    },
    intercept: {
      mode: config.mode,
      mockResponses: config.intercept?.mockResponses ?? {},
    },
  },
  nodeEnv,
);

if (enabled) {
  setRouteMocks(config.intercept?.routes ?? []);
  applyInterceptState(config.intercept?.state ?? {});
}
```

## Notes

- `strict` blocks unmatched wallet/network/frame interactions.
- `permissive` forwards unmatched interactions to original runtime behavior.
- Built-in WebSocket bypass covers common HMR channels (`vite-hmr`, `webpack-hmr`, `next-hmr`).
