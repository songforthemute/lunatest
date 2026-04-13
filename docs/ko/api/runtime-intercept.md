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
