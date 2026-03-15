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
  walletFallbackMode: "manual-toggle",
  walletPreset: {
    address: "0x1111111111111111111111111111111111111111",
    chainId: "0xaa36a7",
    permissions: ["eth_accounts"],
    assets: {
      nativeBalance: "1",
      tokens: {},
    },
  },
});
```

`walletFallbackMode`는 인브라우저 위젯에서 Luna Wallet 토글 UI를 노출할지 결정합니다.
`walletPreset`은 주소/체인/권한/seeded asset state를 초기값으로 주입합니다.

수동 고급 모드가 필요한 경우에는 `enableLunaIntercept` + `mountLunaDevtools`를 직접 조합할 수 있습니다.
