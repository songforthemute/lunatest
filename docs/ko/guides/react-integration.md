# React 통합 가이드

이 문서는 React 앱에서 LunaTest provider를 붙이고, wagmi/ethers/web3.js와 연결하는 최소 단계를 정리합니다.

## 1) Provider 연결

```tsx
import { LunaTestProvider } from "@lunatest/react";

export function Root() {
  return (
    <LunaTestProvider options={{ chainId: "0x1" }}>
      <App />
    </LunaTestProvider>
  );
}
```

## 2) Hook으로 provider 접근

```tsx
import { useLunaTest } from "@lunatest/react";

export function AccountButton() {
  const { provider } = useLunaTest();

  async function loadAccounts() {
    const accounts = await provider.request({ method: "eth_accounts" });
    console.log(accounts);
  }

  return <button onClick={loadAccounts}>계정 불러오기</button>;
}
```

## 3) wagmi 연결

```ts
import { LunaProvider } from "@lunatest/core";
import { withLunaWagmiConfig } from "@lunatest/react";

const provider = new LunaProvider({ chainId: "0x1" });
const wagmiConfig = withLunaWagmiConfig({ chains: [{ id: 1 }] }, provider);
```

## 4) ethers 연결

```ts
import { LunaProvider } from "@lunatest/core";
import { createEthersAdapter } from "@lunatest/react";

const provider = new LunaProvider({ chainId: "0x1" });
const ethersLike = createEthersAdapter(provider);

await ethersLike.send("eth_chainId");
```

## 5) web3.js 연결

```ts
import { LunaProvider } from "@lunatest/core";
import { createWeb3JsAdapter } from "@lunatest/react";

const provider = new LunaProvider({ chainId: "0x1" });
const web3Like = createWeb3JsAdapter(provider);

await web3Like.request({ method: "eth_chainId" });
```

## 문제 해결 체크리스트

- `useLunaTest must be used within LunaTestProvider` 에러가 뜨면 컴포넌트 트리 상단에 `LunaTestProvider`가 있는지 확인합니다.
- `Unsupported method` 에러가 뜨면 호출한 RPC 메서드가 현재 mock/provider에서 지원되는지 확인합니다.
