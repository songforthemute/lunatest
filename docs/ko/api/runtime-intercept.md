# API: @lunatest/runtime-intercept

배포 채널: `latest`

`@lunatest/runtime-intercept`는 로컬 인터랙티브 테스트를 위한 브라우저 런타임 계층입니다.

## 공개 API

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

`wallet.session`은 intercept runtime이 활성화되기 전에 wallet state를 미리 주입하는 public config hook입니다.

wallet session에는 결정론 테스트 전용 metadata를 포함할 수 있습니다.

```ts
type LunaWalletSession = {
  enabled: boolean;
  connected: boolean;
  chainId: string;
  accounts: string[];
  permissions: Array<{ parentCapability: string }>;
  assets: {
    nativeBalance: string;
    tokens: Record<string, { symbol?: string; decimals?: number; balance: string; allowance: string }>;
  };
  knownChains?: Record<string, { chainId: string; chainName?: string; rpcUrls?: string[] }>;
  watchedAssets?: Array<{ type: string; options: Record<string, unknown> }>;
  behavior?: {
    userRejectedMethods?: string[];
  };
};
```

## `normalizeRuntimeInterceptConfig(input)`

`normalizeRuntimeInterceptConfig()`는 runtime config를 다음과 같은 normalized object로 바꿉니다.

- `wallet.session`을 full `LunaWalletSession`으로 materialize
- `intercept.mode`는 생략 시 `strict`로 기본값 적용
- `intercept.routing`은 legacy route list가 들어와도 배열로 정규화
- `intercept.mockResponses`는 plain record로 복제

## 활성화 우선순위

1. `enable`이 boolean으로 명시되면 그 값을 그대로 사용합니다.
2. 아니면 resolved environment가 `development`일 때만 활성화합니다.

## wallet session helper

이 helper들은 active runtime handle에 대해 동작합니다.

- `setWalletSession(session)`: 현재 wallet session을 갱신하고 normalized session을 반환
- `getWalletSession()`: 현재 session 반환
- `connectWalletSession(address?)`: connected 상태로 전환하고 필요하면 address 하나를 주입
- `disconnectWalletSession()`: disconnected 상태로 전환

## Wallet method 지원

interceptor는 frontend integration test에 필요한 주요 EIP-1193 및 wallet method를 처리합니다.

- Chain/session: `eth_chainId`, `net_version`, `eth_accounts`, `eth_requestAccounts`, `wallet_switchEthereumChain`, `wallet_addEthereumChain`
- Permission: `wallet_requestPermissions`, `wallet_getPermissions`, `wallet_revokePermissions`
- Balance/gas/block: `eth_getBalance`, `eth_getTransactionCount`, `eth_blockNumber`, `eth_gasPrice`, `eth_estimateGas`, `eth_feeHistory`, `eth_maxPriorityFeePerGas`, `eth_getBlockByNumber`
- Protocol/transaction: `eth_call`, `eth_sendTransaction`, `eth_getTransactionReceipt`, `eth_getLogs`
- Signing/assets: `personal_sign`, `eth_signTypedData_v4`, `wallet_watchAsset`

지원하지 않는 wallet method는 strict mode에서 provider error code `4200`으로 실패합니다. 결정론적인 user rejection은 `wallet.session.behavior.userRejectedMethods`로 모델링할 수 있습니다.

wallet asset의 `nativeBalance`, token `balance`, token `allowance`는 integer base-unit string입니다. Runtime protocol handler는 ERC-20 approval과 지원 protocol transaction effect에서 이 값을 읽고 갱신합니다.

## 최소 예시

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

## 동작 요약

- `strict`: 매핑되지 않은 wallet/network/frame interaction을 차단
- `permissive`: 매핑되지 않은 interaction을 원본 runtime으로 전달
- WebSocket은 기본적으로 HMR 채널(`vite-hmr`, `webpack-hmr`, `next-hmr`)을 우회
