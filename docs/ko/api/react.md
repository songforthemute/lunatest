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
- `LunaDevtoolsPanel`
- `mountLunaDevtools`

실무에서는 `LunaTestProvider` + `useLunaTest` 조합으로 시작하고, 개발 서버에서는 `enableLunaIntercept` + `mountLunaDevtools`를 같이 두는 경우가 많습니다.

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
