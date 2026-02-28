# 라이브러리 소비자 가이드

이 문서는 LunaTest를 "이미 운영 중인 프론트엔드 프로젝트에 라이브러리로 붙여 쓰는 팀" 기준으로 정리했습니다.

핵심은 간단합니다. 필요한 레이어만 골라 설치하고, 엔트리 파일에서 한 줄로 동작을 켭니다.

## 어떤 패키지를 고르면 되나

- `@lunatest/core`: EIP-1193 provider를 직접 제어하고 싶을 때
- `@lunatest/react`: React provider/hook, wagmi/ethers/web3.js 어댑터까지 같이 쓸 때
- `@lunatest/mcp`: 에이전트 연동, stdio JSON-RPC 워크플로가 필요할 때
- `@lunatest/vitest-plugin`: Vitest matcher를 바로 붙이고 싶을 때
- `@lunatest/playwright-plugin`: Playwright에서 provider 주입 + 네트워크 라우팅 모킹을 할 때
- `@lunatest/runtime-intercept`: 개발 서버를 띄운 브라우저에서 직접 인터랙션 테스트를 하고 싶을 때

## 설치 예시

```bash
pnpm add @lunatest/core @lunatest/react @lunatest/mcp
pnpm add @lunatest/runtime-intercept
pnpm add -D @lunatest/vitest-plugin
```

## Core Provider 최소 예시

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

## 런타임 Intercept 예시 (개발 서버 브라우저)

### 1) 앱 루트에 `lunatest.lua` 작성

```lua
scenario {
  name = "runtime-dev",
  mode = "strict",
  given = { chain = { id = 1 }, wallet = { connected = true } },
  intercept = {
    routes = {
      { endpointType = "ethereum", method = "eth_chainId", responseKey = "wallet.chainId" },
      { endpointType = "ethereum", method = "eth_accounts", responseKey = "wallet.accounts" },
      { endpointType = "rpc", urlPattern = "**/rpc", methods = { "eth_call" }, responseKey = "rpc.call" },
      { endpointType = "http", urlPattern = "**/api/quote", method = "GET", responseKey = "api.quote" },
    },
    mockResponses = {
      ["wallet.chainId"] = { result = "0x1" },
      ["wallet.accounts"] = { result = { "0x1111111111111111111111111111111111111111" } },
      ["rpc.call"] = { result = "0x01" },
      ["api.quote"] = { status = 200, body = { amountOut = "123.45" } },
    },
    state = { chain = { blockNumber = 19000000 } },
  },
}
```

### 2) 엔트리 파일(`src/main.tsx`)에서 1줄 부트스트랩

```ts
import { bootstrapLunaRuntime } from "@lunatest/react";

const nodeEnv =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.MODE) ??
  (typeof process !== "undefined" ? process.env.NODE_ENV : undefined);

void bootstrapLunaRuntime({
  source: "./lunatest.lua",
  nodeEnv,
  mountDevtools: true,
});
```

활성화 규칙은 다음과 같습니다.

- `enable` 값을 직접 넣으면 그 값이 최우선입니다.
- `enable`을 생략하면 `nodeEnv`가 `"development"`일 때만 자동 활성화됩니다.

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

  return <button onClick={load}>{scenarioId ? `active: ${scenarioId}` : "load wallet"}</button>;
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

- [E2E 0→1 워크스루](./e2e-0to1.md)
- [시나리오 예제 모음](./scenario-examples.md)
- [React 통합 가이드](./react-integration.md)
- [Playwright 라우팅 모킹](./playwright-routing.md)
