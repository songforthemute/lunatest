# API: @lunatest/react

배포 채널: `latest`

## 공개 API

- `createLunaProvider`
- `LunaTestProvider`
- `useLunaProvider`
- `useLunaTest`
- `withLunaWagmiConfig`
- `createEthersAdapter`
- `createWeb3JsAdapter`
- `enableLunaIntercept`
- `bootstrapLunaRuntime`
- `LunaDevtoolsPanel`
- `mountLunaDevtools`

브라우저 전용 bootstrap/devtools 경로에서는 `@lunatest/react/browser`를 권장합니다.

## `bootstrapLunaRuntime(options?)`

```ts
type LunaBootstrapOptions = {
  enable?: boolean;
  source?: string | URL;
  nodeEnv?: string;
  mountDevtools?: boolean;
  devtoolsTargetId?: string;
  presetRegistry?: PresetRegistry;
  projectPresetSources?: ProjectPresetSources;
  protocolPresetId?: string;
  protocolPresetParams?: Record<string, unknown>;
  walletPresetId?: string;
  walletPresetParams?: Record<string, unknown>;
  walletFallbackMode?: "off" | "manual-toggle";
  walletPreset?: {
    address: string;
    chainId?: string;
    permissions?: Array<LunaWalletPermission | string>;
    assets?: Partial<LunaWalletAssetState>;
  };
  configOverride?: Partial<LunaRuntimeInterceptConfig>;
};

type LunaBootstrapResult = {
  enabled: boolean;
  configLoaded: boolean;
  unmountDevtools?: () => void;
  config?: LuaConfig;
};
```

`bootstrapLunaRuntime()`는 현재 shipped 된 bootstrap option surface를 모두 받습니다.

- `source`: Lua config 경로 또는 URL, 기본값은 `./lunatest.lua`
- `enable`: 명시적 on/off override
- `nodeEnv`: bootstrap gate용 환경 오버라이드
- `mountDevtools` / `devtoolsTargetId`: devtools mounting 제어
- `presetRegistry`: 이미 만들어 둔 registry 재사용
- `projectPresetSources`: prebuilt registry 없이 local preset source 주입
- `protocolPresetId` / `protocolPresetParams`: protocol preset 선택 및 materialize
- `walletPresetId` / `walletPresetParams`: wallet preset 선택 및 materialize
- `walletFallbackMode`: Luna Wallet fallback UI 모드
- `walletPreset`: 직접 wallet session seed 주입
- `configOverride`: partial runtime-intercept config override

활성화 우선순위는 다음과 같습니다.

1. `enable`이 명시되면 그 값이 우선
2. 없으면 `configOverride.enable`
3. 없으면 `development`에서만 활성화

activation gate에서 막히면 `{ enabled: false, configLoaded: false }`를 반환하고 Lua source를 읽지 않습니다.

반환값에는 `enabled`, `configLoaded`, optional `config`, optional `unmountDevtools`가 포함됩니다.

`protocolPresetId`를 넘기면 bootstrap은 materialized payload를 아래 순서로 적용합니다.

1. `lunatest.lua`의 config route mock과 config state
2. `protocol.runtime`을 포함한 protocol preset route mock
3. `protocolRuntime`을 포함한 protocol preset `interceptState`
4. protocol preset wallet session
5. optional `walletPresetId` override
6. optional direct `walletPreset` override

Devtools panel은 active protocol, chain id, token count, route count, supported method count를 보여주는 compact protocol runtime preview를 제공합니다.

## 관련 entrypoint

- `LunaTestProvider` / `useLunaProvider`: React state와 provider reuse
- `enableLunaIntercept`: 수동 intercept activation
- `mountLunaDevtools`: `bootstrapLunaRuntime()` 없이 devtools panel만 mount할 때 사용

## 최소 예시

```tsx
import { LunaTestProvider, useLunaTest } from "@lunatest/react";

function Demo() {
  const { provider } = useLunaTest();
  return <button onClick={() => provider.request({ method: "eth_chainId" })}>chain 확인</button>;
}

export function App() {
  return (
    <LunaTestProvider options={{ chainId: "0x1" }}>
      <Demo />
    </LunaTestProvider>
  );
}
```
