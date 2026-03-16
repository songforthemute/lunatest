# API: @lunatest/core

배포 채널: `latest`

## 공개 API

- `LunaProvider`
- `LunaProviderOptions`
- `loadLunaConfig(source)`
- `listProtocolPresets()`
- `getProtocolPreset(id)`
- `materializeProtocolPreset(id, params)`
- `validateProtocolPresetSource(source, context?)`
- `listWalletPresets()`
- `getWalletPreset(id)`
- `materializeWalletPreset(id, params?)`
- `validateWalletPresetSource(source, context?)`
- `getPresetDiagnostics(registry?)`
- `createScenarioRuntime(config)`
- `LuaConfig`
- `RouteMock`

개발 서버 브라우저 인터셉트는 [API: @lunatest/runtime-intercept](./runtime-intercept.md)에서 확인할 수 있습니다.

Preset registry는 built-in Lua manifest를 catalog/API로 승격한 계층입니다.  
`materializeProtocolPreset()`은 `walletSession`, `interceptState`, `routeMocks`, `builtinScenarios`를 함께 반환합니다.

local preset 진단도 같은 계층에서 확인할 수 있습니다.

- `validateProtocolPresetSource()` / `validateWalletPresetSource()`는 개별 source를 검증합니다.
- `getPresetDiagnostics()`는 registry에 로드된 built-in / project-local preset의 structured diagnostics를 돌려줍니다.

## `LunaProviderOptions`

- `chainId?: string`
- `accounts?: string[]`
- `balances?: Record<string, string>`
- `callHandler?: (input) => Promise<string> | string`

## 사용 예시

```ts
import { LunaProvider } from "@lunatest/core";

const provider = new LunaProvider({
  chainId: "0x1",
  accounts: ["0x1111111111111111111111111111111111111111"],
  balances: {
    "0x1111111111111111111111111111111111111111": "0xde0b6b3a7640000",
  },
});

await provider.request({ method: "eth_chainId" });
await provider.request({ method: "eth_accounts" });
await provider.request({
  method: "wallet_switchEthereumChain",
  params: [{ chainId: "0xaa36a7" }],
});
```

## 지원 메서드 (요약)

- `eth_chainId`
- `eth_accounts`
- `eth_getBalance`
- `eth_call`
- `eth_sendTransaction`
- `eth_getTransactionReceipt`
- `wallet_switchEthereumChain`
- `eth_subscribe`
