# API: @lunatest/runtime-intercept

Release channel: `next`

`@lunatest/runtime-intercept` is a browser runtime layer for local interactive testing.

## Public API

- `enableLunaRuntimeIntercept(config)`
- `disableLunaRuntimeIntercept()`
- `createLunaRuntimeIntercept(config)`
- `resolveEnabled(config, nodeEnv?)`
- `LunaRuntimeInterceptConfig`

## `LunaRuntimeInterceptConfig`

```ts
type LunaRuntimeInterceptConfig = {
  enable?: boolean;
  debug?: boolean;
  intercept?: {
    mode?: "strict" | "permissive";
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
import config from "../lunatest.config";
import { enableLunaRuntimeIntercept } from "@lunatest/runtime-intercept";

enableLunaRuntimeIntercept(config);
```

## Notes

- `strict`: blocks unmatched wallet/network/frame interactions.
- `permissive`: forwards unmatched interactions to original runtime behavior.
- Built-in WebSocket bypass covers common HMR channels (`vite-hmr`, `webpack-hmr`, `next-hmr`).
