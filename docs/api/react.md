# API: @lunatest/react

배포 채널: `latest`

주요 API:

- `createLunaProvider`
- `LunaTestProvider`
- `useLunaTest`
- `useLunaProvider`
- `withLunaWagmiConfig`
- `createEthersAdapter`
- `createWeb3JsAdapter`
- `enableLunaIntercept`
- `bootstrapLunaRuntime`
- `LunaDevtoolsPanel`
- `mountLunaDevtools`

React 앱에서는 `LunaTestProvider` + `useLunaTest` 조합을 기본 패턴으로 사용하고, 개발 서버 런타임 모킹은 `bootstrapLunaRuntime`를 기본 경로로 권장합니다.

## `bootstrapLunaRuntime(options?)`

```ts
import { bootstrapLunaRuntime } from "@lunatest/react";

const nodeEnv =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.MODE) ??
  (typeof process !== "undefined" ? process.env.NODE_ENV : undefined);

void bootstrapLunaRuntime({
  source: "./lunatest.lua",
  nodeEnv,
  mountDevtools: true,
});
```

수동 고급 모드가 필요한 경우에는 `enableLunaIntercept` + `mountLunaDevtools`를 직접 조합할 수 있습니다.
