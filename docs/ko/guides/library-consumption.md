# 라이브러리 소비자 가이드

이 문서는 LunaTest를 "라이브러리로 가져다 쓰는 팀" 기준으로 작성했습니다.
필요한 패키지만 설치해도 동작하도록 구성했습니다.

## 패키지 선택 기준

- `@lunatest/core`: EIP-1193 provider를 직접 다룰 때
- `@lunatest/react`: React provider/hook, wagmi/ethers/web3.js 어댑터가 필요할 때
- `@lunatest/mcp`: 에이전트 연동 또는 stdio JSON-RPC 통신이 필요할 때
- `@lunatest/vitest-plugin`: Vitest matcher를 붙이고 싶을 때
- `@lunatest/playwright-plugin`: 브라우저 주입 + 네트워크 라우팅 모킹이 필요할 때

## 설치 예시

```bash
pnpm add @lunatest/core @lunatest/react @lunatest/mcp
pnpm add -D @lunatest/vitest-plugin @lunatest/playwright-plugin
```

## Core Provider 사용 예시

```ts
import { LunaProvider } from "@lunatest/core";

const provider = new LunaProvider({
  chainId: "0x1",
  accounts: ["0x1111111111111111111111111111111111111111"],
  balances: {
    "0x1111111111111111111111111111111111111111": "0xde0b6b3a7640000",
  },
});

const chainId = await provider.request({ method: "eth_chainId" });
const accounts = await provider.request({ method: "eth_accounts" });
```

## React 통합 예시

```tsx
import { LunaTestProvider, useLunaTest } from "@lunatest/react";

function WalletStatus() {
  const { provider, scenarioId, setScenarioId } = useLunaTest();

  async function load() {
    const accounts = await provider.request({ method: "eth_accounts" });
    console.log(accounts);
    setScenarioId("swap-smoke");
  }

  return (
    <button onClick={load}>
      {scenarioId ? `active: ${scenarioId}` : "load wallet"}
    </button>
  );
}

export function App() {
  return (
    <LunaTestProvider options={{ chainId: "0x1" }}>
      <WalletStatus />
    </LunaTestProvider>
  );
}
```

## 어댑터 예시 (wagmi / ethers / web3.js)

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

await ethersLike.send("eth_chainId");
await web3Like.request({ method: "eth_chainId" });
await wagmiConfig.transports?.[1]?.request({ method: "eth_chainId" });
```

## MCP stdio 서버 예시

```ts
import { createMcpServer, runStdioServer } from "@lunatest/mcp";

const server = createMcpServer({
  scenarios: [{ id: "swap-smoke", name: "Swap Smoke", lua: "scenario {}" }],
});

await runStdioServer({
  input: process.stdin,
  output: process.stdout,
  server,
});
```

## 다음으로 보면 좋은 문서

- [시나리오 예제 모음](./scenario-examples.md)
- [React 통합 가이드](./react-integration.md)
- [Playwright 라우팅 모킹](./playwright-routing.md)
