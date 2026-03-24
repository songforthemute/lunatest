# API: @lunatest/core

배포 채널: `latest`

## 공개 API

- `LunaProvider`
- `LunaProviderOptions`
- `loadLunaConfig(source)`
- `@lunatest/core/browser`
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

브라우저 앱에서 Lua config/preset registry를 직접 쓸 때는 `@lunatest/core/browser` subpath를 권장합니다.  
Node 전용 helper인 `loadProjectPresetSources()`는 root `@lunatest/core`에만 두고 browser subpath에서는 노출하지 않습니다.

local preset 진단도 같은 계층에서 확인할 수 있습니다.

- `validateProtocolPresetSource()` / `validateWalletPresetSource()`는 개별 source를 검증합니다.
- `getPresetDiagnostics()`는 registry에 로드된 built-in / project-local preset의 structured diagnostics를 돌려줍니다.

Scenario / Lua config는 optional coverage metadata를 지원합니다.

- `coverage.features?: string[]`
- `coverage.states?: string[]`
- `coverage.components?: string[]`

metadata가 없으면 LunaTest는 `when.action`, `then_ui`, `then_state`, `not_present`에서 기본 coverage를 추론합니다.

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
