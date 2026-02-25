# API: @lunatest/runtime-intercept

배포 채널: `next`

`@lunatest/runtime-intercept`는 개발 서버 브라우저에서 지갑/네트워크 상호작용을 가로채는 런타임 계층입니다.

## 공개 API

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

## 활성화 우선순위

1. `enable` 값이 명시되어 있으면 해당 값을 그대로 사용합니다.
2. `enable`이 없으면 `NODE_ENV === "development"`일 때만 켭니다.

## 최소 사용 예시

```ts
import config from "../lunatest.config";
import { enableLunaRuntimeIntercept } from "@lunatest/runtime-intercept";

enableLunaRuntimeIntercept(config);
```

## 동작 요약

- `strict`: 매핑되지 않은 요청/프레임은 차단
- `permissive`: 매핑되지 않은 요청/프레임은 원본 경로로 전달
- WebSocket은 기본적으로 HMR 채널(`vite-hmr`, `webpack-hmr`, `next-hmr`)을 우회
