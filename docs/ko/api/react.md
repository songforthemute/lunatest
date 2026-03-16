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

실무에서는 `LunaTestProvider` + `useLunaTest` 조합으로 시작하고, 개발 서버 런타임 모킹은 `bootstrapLunaRuntime`을 기본으로 두는 편이 안전합니다.

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

`walletFallbackMode`는 인브라우저 위젯에 Luna Wallet 토글을 노출할지 결정합니다.  
`walletPreset`은 주소, 체인, 권한, seeded asset state를 초기값으로 주입합니다.
`enable` 또는 `configOverride.enable`을 따로 주지 않으면 `bootstrapLunaRuntime()`는 development에서만 자동 활성화됩니다.  
production에서 켜려면 `enable: true` 또는 `configOverride: { enable: true }`를 명시해야 합니다.

반환값에는 `enabled`, `configLoaded`, `config?`, `unmountDevtools?`가 들어갑니다.  
production 선제 게이트에서 막힌 경우에는 `configLoaded: false`가 반환되고 Lua source도 읽지 않습니다.

세밀한 제어가 필요하면 `enableLunaIntercept` + `mountLunaDevtools`를 직접 조합하는 고급 모드를 사용하면 됩니다.

## 최소 예시

```tsx
import { LunaTestProvider, useLunaTest } from "@lunatest/react";

function Demo() {
  const { provider } = useLunaTest();

  async function onClick() {
    const chainId = await provider.request({ method: "eth_chainId" });
    console.log(chainId);
  }

  return <button onClick={onClick}>check chain</button>;
}

export function App() {
  return (
    <LunaTestProvider options={{ chainId: "0x1" }}>
      <Demo />
    </LunaTestProvider>
  );
}
```

## 어댑터 예시

```ts
import { LunaProvider } from "@lunatest/core";
import {
  withLunaWagmiConfig,
  createEthersAdapter,
  createWeb3JsAdapter,
} from "@lunatest/react";

const provider = new LunaProvider({ chainId: "0x1" });

const wagmiConfig = withLunaWagmiConfig({ chains: [{ id: 1 }] }, provider);
const ethersLike = createEthersAdapter(provider);
const web3Like = createWeb3JsAdapter(provider);
```
