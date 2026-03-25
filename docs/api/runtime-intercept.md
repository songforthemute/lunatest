# API: @lunatest/runtime-intercept

Release channel: `latest`

`@lunatest/runtime-intercept` is a browser runtime layer for local interactive testing.

## Public API

- `enableLunaRuntimeIntercept(config)`
- `disableLunaRuntimeIntercept()`
- `createLunaRuntimeIntercept(config)`
- `setRouteMocks(routes)`
- `appendRouteMocks(routes)`
- `applyInterceptState(partialState)`
- `getInterceptState()`
- `resolveEnabled(config, nodeEnv?)`
- `LunaRuntimeInterceptConfig`

## `LunaRuntimeInterceptConfig`

```ts
type LunaRuntimeInterceptConfig = {
  enable?: boolean;
  debug?: boolean;
  intercept?: {
    mode?: "strict" | "permissive";
    routes?: Array<
      | { endpointType: "ethereum"; method: string; responseKey: string }
      | { endpointType: "rpc"; urlPattern: string | RegExp; methods?: string[]; responseKey: string }
      | { endpointType: "http"; urlPattern: string | RegExp; method?: string; responseKey: string }
      | { endpointType: "ws"; urlPattern: string | RegExp; responseKey: string; match?: string | RegExp }
    >;
    routing?: {
      ethereumMethods?: Array<{
        method: string;
        responseKey: string;
      }>;
      rpcEndpoints?: Array<{
        urlPattern: string | RegExp;
        methods?: string[];
        responseKey: string;
      }>;
      httpEndpoints?: Array<{
        urlPattern: string | RegExp;
        method?: string;
        responseKey: string;
      }>;
      wsEndpoints?: Array<{
        urlPattern: string | RegExp;
        responseKey: string;
        match?: string | RegExp;
      }>;
      bypassWsPatterns?: Array<string | RegExp>;
    };
    mockResponses?: Record<string, unknown | ((ctx) => unknown | Promise<unknown>)>;
  };
};
```

## Activation Priority

1. If `enable` is explicitly boolean, it wins.
2. Otherwise, activation happens only when `NODE_ENV === "development"`.

## Minimal Example

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

- `strict`: blocks unmatched wallet/network/frame interactions.
- `permissive`: forwards unmatched interactions to original runtime behavior.
- Built-in WebSocket bypass covers common HMR channels (`vite-hmr`, `webpack-hmr`, `next-hmr`).
