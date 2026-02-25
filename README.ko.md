# LunaTest (한국어 가이드)

> Web3 프론트엔드 테스트를 위한 결정론(Deterministic) SDK
> 체인 포크나 flaky 테스트 없이, 밀리초 단위로 빠르게 검증
> English version: [README.md](./README.md)

LunaTest는 Anvil fork, RPC stub, 느린 브라우저 E2E 중심의 기존 Web3 테스트 흐름을
Wasm 기반 Lua 런타임으로 바꿔서, 빠르고 재현 가능한 테스트 경험을 제공합니다.

## 빠른 시작

```bash
pnpm install --frozen-lockfile
pnpm -r build
pnpm -r lint
pnpm -r test
pnpm test:e2e:smoke
```

야간 확장 검증:

```bash
pnpm test:e2e:extended
node scripts/check-performance.mjs --mode=absolute --threshold=5
```

## 사용 가이드

1. 기본 품질 게이트를 실행합니다.

```bash
pnpm -r build
pnpm -r lint
pnpm -r test
pnpm test:e2e:smoke
```

2. 문서 사이트를 로컬에서 띄웁니다.

```bash
pnpm docs:dev
```

3. 채널별로 배포합니다.

```bash
pnpm release:publish:stable
pnpm release:publish:next
```

4. 주요 문서 진입점
- 시작 가이드: `docs/getting-started.md`
- 아키텍처: `docs/concepts/architecture.md`
- CI 게이트: `docs/guides/ci-integration.md`

## 저장소 구조

| 경로 | 설명 |
| --- | --- |
| `packages/core` | 런타임, 시나리오 엔진, mock provider, runner |
| `packages/cli` | `lunatest` CLI (`run/watch/coverage/gen`) |
| `packages/react` | React provider/hooks 및 adapter |
| `packages/mcp` | MCP server, tools/resources/prompts, stdio transport |
| `packages/vitest-plugin` | Vitest 플러그인/매처 |
| `packages/playwright-plugin` | Playwright fixture 및 라우팅 헬퍼 |
| `e2e-tests` | smoke/extended E2E 테스트 |
| `docs` | VitePress 문서 사이트 |
| `examples` | 예제 앱 및 시나리오 |
| `scripts` | 성능 게이트 및 보조 스크립트 |

## 라이브러리 사용 예시

필요한 패키지만 골라 설치합니다.

```bash
pnpm add @lunatest/core
pnpm add @lunatest/react
pnpm add @lunatest/mcp
pnpm add -D @lunatest/vitest-plugin @lunatest/playwright-plugin
```

### 1) Core provider

```ts
import { LunaProvider } from "@lunatest/core";

const provider = new LunaProvider({
  chainId: "0x1",
  accounts: ["0x1111111111111111111111111111111111111111"],
});

await provider.request({ method: "eth_chainId" });
```

### 2) React 연동

```tsx
import { LunaTestProvider, useLunaTest } from "@lunatest/react";

function View() {
  const { provider } = useLunaTest();
  return <span>{String(Boolean(provider))}</span>;
}

export function App() {
  return (
    <LunaTestProvider options={{ chainId: "0x1" }}>
      <View />
    </LunaTestProvider>
  );
}
```

### 3) 어댑터(wagmi/ethers/web3.js)

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

### 4) MCP stdio 실행

```ts
import { createMcpServer, runStdioServer } from "@lunatest/mcp";

await runStdioServer({
  input: process.stdin,
  output: process.stdout,
  server: createMcpServer({ scenarios: [] }),
});
```

더 자세한 내용은 `docs/guides/library-consumption.md`를 참고하세요.

## 릴리스 채널

- `latest`: `@lunatest/core`, `@lunatest/cli`, `@lunatest/react`, `@lunatest/mcp`
- `next`: `@lunatest/vitest-plugin`, `@lunatest/playwright-plugin`

## CI / 게이트

- 품질 게이트: `.github/workflows/ci.yml`
- 야간 성능/확장 게이트: `.github/workflows/benchmark.yml`
- 문서 배포: `.github/workflows/docs.yml` (GitHub Pages)
- 릴리스 파이프라인: `.github/workflows/release.yml`

## 라이선스

MIT
