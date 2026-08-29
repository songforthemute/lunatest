# LunaTest (한국어 가이드)

> Web3 프론트엔드를 위한 결정론 테스트 SDK
> 문서화된 지갑·RPC 프론트엔드 흐름에는 외부 체인이나 포크가 필요 없습니다. 측정 근거를 갖춘 결정론적 Web3 UI 테스트
> English version: [README.md](./README.md)

LunaTest는 Wasm 기반 Lua 런타임으로 지갑·RPC 의존 프론트엔드 흐름을 빠르고
재현 가능하게 테스트합니다. 정확한 protocol 동작이 필요하면 Anvil, Foundry,
forked RPC 테스트를 함께 사용하고, HTTP 경계는 애플리케이션별 mock을 함께 사용하세요.

패키지 상태: `Published` (stable 패키지가 npm에 배포되어 있습니다.)

대표 wagmi swap proof는 npm의 정확한 `latest` 패키지 집합을 대상으로 Vitest와
Chromium에서 E2 인증을 마쳤습니다. 자세한 내용은
[검증된 빠른 시작](./docs/ko/guides/wagmi-swap-quickstart.md)을 참고하세요.

## 기존 앱에서 시작하기

테스트하려는 경계에 맞는 패키지만 설치하세요. provider만 필요한 가장 작은 설정은
다음과 같습니다.

```bash
pnpm add @lunatest/core
```

프로젝트 scenario 명령을 사용하려면 공개 CLI를 설치하고 설치된 실행 파일을
사용합니다.

```bash
pnpm add -D @lunatest/cli
pnpm exec lunatest validate
```

[빠른 시작](./docs/ko/getting-started.md)에서 패키지 선택을 확인하고, 실행 가능한
[라이브러리 소비자 가이드](./docs/ko/guides/library-consumption.md)와
[CLI 워크플로](./docs/ko/guides/cli-workflow.md)를 참고하세요. 아래 예시는 provider,
React, 통합 경계를 더 자세히 보여 줍니다.

## 이 저장소에 기여하기

저장소 CI의 기준 환경은 Node 24와 pnpm 10.33.4입니다. 이는 저장소의 CI/tooling
기준일 뿐, 모든 공개 패키지가 Node 24를 요구한다는 뜻은 아닙니다.

Node 24 설치에 Corepack이 포함되어 있다면 활성화한 뒤 저장소의
`packageManager` 필드가 pnpm 10.33.4를 선택하도록 할 수 있습니다.

```bash
corepack enable
corepack install
```

Corepack을 사용할 수 없거나 환경에 맞지 않으면, 다른 지원 방법으로 같은 pnpm
버전을 설치하세요. 예를 들면 다음과 같습니다.

```bash
npm install --global pnpm@10.33.4
```

그 다음 contributor용 로컬 체크를 실행합니다.

```bash
pnpm install --frozen-lockfile
pnpm -r lint
pnpm run build
pnpm -r test
pnpm test:e2e:smoke
```

유지보수 / 릴리스 게이트:

```bash
pnpm lint:deadcode
pnpm pack:check-integrity
```

`pnpm test:e2e:smoke`는 로컬 E2E 명령입니다. 이 명령이 읽는 workspace package entry를 만들기 위해 먼저 workspace build writer를 직렬화하는 `pnpm run build`를 실행해야 합니다.

### CI 재현 및 수동 Benchmark

fresh checkout CI job은 로컬 E2E/성능 명령 대신 아래 CI 계약 명령을 사용합니다.

```bash
pnpm lint:workspace-types
pnpm run build:workspace:ci
pnpm run lint:workspace:ci
pnpm run test:workspace:ci
pnpm lint:deadcode
pnpm pack:check-integrity
pnpm run test:e2e:smoke:ci
pnpm run perf:regression:ci
```

필요할 때 수동으로 실행하는 Benchmark workflow에서는 아래 명령도 실행합니다.

```bash
pnpm run test:e2e:extended:ci
pnpm run perf:absolute:ci
```

`lint:workspace-types`는 lint 전에 package `dist` 디렉터리를 임시로 제거합니다. `*:ci` wrapper는 fresh checkout에 package 산출물이 없을 때 필요한 prebuild를 중앙화합니다. 일반 로컬 반복에서는 위의 로컬 명령을 사용하고, CI 재현이 필요할 때만 wrapper를 사용합니다.

CI wrapper와 성능 명령은 저장소 유지보수 또는 로컬 CI 재현용입니다. job 그래프와
릴리스 정책은 [CI 통합 가이드](./docs/ko/guides/ci-integration.md)를 참고하세요.

### 저장소 문서와 릴리스

문서 사이트는 `pnpm docs:dev`로 실행하고, stable 패키지는
`pnpm release:publish:stable`로 배포합니다. 가이드, API 레퍼런스, 검증된 wagmi
빠른 시작은 [문서 색인](./docs/ko/index.md)에서 확인하세요.

## 저장소 구조

| 경로 | 설명 |
| --- | --- |
| `packages/core` | 런타임, 시나리오 엔진, mock provider, runner |
| `packages/cli` | `lunatest` CLI (`run/watch/coverage/gen/devtools/doctor`) |
| `packages/react` | React provider/hooks 및 adapter |
| `packages/mcp` | MCP server, tools/resources/prompts, stdio transport |
| `packages/vitest-plugin` | Vitest project scenario runner 및 매처 |
| `packages/playwright-plugin` | Playwright 라우팅 및 page-bound scenario runner |
| `packages/runtime-intercept` | 개발 서버 브라우저 런타임 인터셉트 |
| `e2e-tests` | smoke/extended E2E 테스트 |
| `docs` | VitePress 문서 사이트 |
| `examples` | 예제 앱 및 시나리오 |
| `scripts` | 성능 게이트 및 보조 스크립트 |

## 라이브러리 사용 예시

필요한 패키지만 골라 설치할 수 있습니다.

```bash
pnpm add @lunatest/core
pnpm add @lunatest/react
pnpm add @lunatest/mcp
pnpm add @lunatest/runtime-intercept
pnpm add -D @lunatest/vitest-plugin @lunatest/playwright-plugin
```

Vitest와 Playwright 연동을 포함한 모든 공개 LunaTest 패키지는 `latest` 채널로 배포됩니다.

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

### 3) 통합 경계 (wagmi / ethers / web3.js)

**검증된 통합:** wagmi와 viem은 실제 wagmi `createConfig` transport 및 connector
경계에서 `@wagmi/core@3.6.4`, `viem@2.55.11` 조합으로 검증되었습니다. 독립 npm
패키지 proof는 [검증된 wagmi 빠른 시작](./docs/ko/guides/wagmi-swap-quickstart.md)을 보세요.

**구조적 어댑터:** `createEthersAdapter`와 `createWeb3JsAdapter`는 문서화된 요청
surface만 `LunaProvider.request`로 전달합니다. ethers나 Web3.js SDK 통합은 아니므로,
버전별 wrapper는 소비 애플리케이션에서 만드세요.

```ts
import { LunaProvider } from "@lunatest/core";
import { createConfig } from "@wagmi/core";
import {
  createEthersAdapter,
  createWeb3JsAdapter,
} from "@lunatest/react";
import { createLunaWagmiTransport } from "@lunatest/react/wagmi";
import { createLunaWagmiConnector } from "@lunatest/react/wagmi/connector";
import { mainnet } from "viem/chains";

const provider = new LunaProvider({ chainId: "0x1" });
const wagmiConfig = createConfig({
  batch: { multicall: false },
  chains: [mainnet],
  connectors: [createLunaWagmiConnector(provider)],
  transports: { [mainnet.id]: createLunaWagmiTransport(provider) },
});
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

### 4.5) CLI config + AI adapter

`lunatest.config.json`:

```json
{
  "scenarioDir": "scenarios",
  "luaConfigPath": "lunatest.lua",
  "coverageCatalog": {
    "features": ["swap", "approve"],
    "states": ["quoteLoaded", "approvalPending"],
    "components": ["quotePanel", "actionButtonRow"]
  },
  "ai": {
    "command": "node",
    "args": ["./adapter.mjs"]
  }
}
```

`lunatest gen --ai`는 stdin JSON으로 `scenarios`, `coverage`, `presetCatalog`, `prompts`를 전달하고, adapter는 stdout JSON array를 반환해야 합니다. 이 명령은 `lunatest.config.json`의 `ai.command`가 있어야 동작합니다. adapter가 `coverage`, `tags`를 포함하면 LunaTest가 generated `.lua`에도 그 metadata를 저장합니다.

`lunatest devtools --open`은 브라우저 devtools 부트스트랩을 위한 project-aware guide를 출력합니다. resolved config path, browser entrypoint, mount API, local preset directory가 함께 표시됩니다.

### 5) 개발 서버 런타임 인터셉트 + 인브라우저 위젯

프로젝트 루트 `lunatest.lua`:

```lua
scenario {
  name = "app-runtime",
  mode = "strict",
  given = { chain = { id = 1 }, wallet = { connected = true } },
  intercept = {
    routes = {
      { endpointType = "ethereum", method = "eth_chainId", responseKey = "wallet.chainId" },
      { endpointType = "http", urlPattern = "**/api/quote", method = "GET", responseKey = "api.quote" },
    },
    mockResponses = {
      ["wallet.chainId"] = { result = "0x1" },
      ["api.quote"] = { status = 200, body = { amountOut = "123.45" } },
    },
  },
}
```

`src/main.tsx` 1줄 부트스트랩 패턴(번들러 독립 env 감지):

```ts
import { bootstrapLunaRuntime } from "@lunatest/react/browser";

const nodeEnv =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.MODE) ??
  (typeof process !== "undefined" ? process.env.NODE_ENV : undefined);

void bootstrapLunaRuntime({
  source: "./lunatest.lua",
  nodeEnv,
  mountDevtools: true,
});
```

production에서는 자동 활성화되지 않습니다. 개발 환경 외에서 런타임 인터셉트를 켜려면 `enable: true` 또는 `configOverride: { enable: true }`를 명시해야 합니다. browser-only bootstrap/devtools에는 `@lunatest/react/browser` 경로를 권장합니다.

Built-in protocol preset(`builtin/uniswap_v2`, `builtin/uniswap_v3`, `builtin/curve`, `builtin/aave`)은 결정론적인 L3 frontend-flow 지원을 목표로 합니다. 정확한 EVM fork를 대체하지는 않습니다. protocol 및 wallet method 지원 범위는 `docs/guides/protocol-support.md`에서 확인할 수 있습니다.

이 preset들을 public LunaTest API와 `window.ethereum.request` 경로로 검증하는 runnable multi-protocol dogfood 앱은 `examples/defi-dashboard` 또는 `docs/guides/defi-dashboard-dogfood.md`에서 확인할 수 있습니다.

### 6) Vitest와 Playwright scenario runner

```ts
import { createLunaVitestPlugin } from "@lunatest/vitest-plugin";

const luna = createLunaVitestPlugin({ cwd: process.cwd() });

await luna.assertScenario("scenarios/quote-ready", {
  runWhen: () => clickQuoteButton(),
  resolveUi: () => ({ quote: { status: readQuoteStatus() } }),
});
```

실제 Playwright page에는 같은 project scenario를 explicit host action과 DOM read에 연결합니다.

```ts
import { createLunaCommands, createLunaPageAdapter } from "@lunatest/playwright-plugin";

await createLunaCommands({ cwd: process.cwd() }).assertScenario(
  "scenarios/quote-ready",
  createLunaPageAdapter({
    page,
    runWhen: ({ page: target }) => target.getByTestId("load-quote").click(),
    resolveUi: async ({ page: target }) => ({
      quote: { status: await target.getByTestId("quote-status").textContent() },
    }),
  }),
);
```

scenario ID는 정확한 project-relative path입니다. integration이 Lua에서 selector나 action을 추론하지 않습니다. `createLunaFixture().injectProvider`는 deprecated이며 wallet emulator가 아닙니다. 결정론적인 wallet 동작에는 `@lunatest/runtime-intercept`를 bootstrap하세요.

더 자세한 내용은 `docs/guides/library-consumption.md`를 참고하세요.

한국어 문서 인덱스: `docs/ko/index.md`
한국어 시나리오 예제: `docs/ko/guides/scenario-examples.md`
한국어 E2E 워크스루: `docs/ko/guides/e2e-0to1.md`

## 올바른 테스트 계층 선택

하나의 테스트 도구가 모든 경계를 검증하지는 않습니다. LunaTest는 문서화된
결정론적 L3 지갑·RPC 프론트엔드 흐름에만 사용하고, 증명하려는 동작에 맞는
계층을 선택하세요.

| 검증할 동작 | 테스트 계층 |
| --- | --- |
| 문서화된 결정론적 L3 지갑·RPC 프론트엔드 흐름 | LunaTest |
| 정확한 EVM bytecode, gas, 과거 상태, protocol math | Anvil, Foundry 또는 forked RPC |
| 애플리케이션 HTTP 경계 | 애플리케이션별 HTTP mock |
| 브라우저의 시각적 동작 또는 lifecycle | [문서화된 browser-runner 경로](./docs/ko/guides/playwright-routing.md) |

## 릴리스 채널

- `latest`: `@lunatest/contracts`, `@lunatest/core`, `@lunatest/runtime-intercept`, `@lunatest/cli`, `@lunatest/react`, `@lunatest/mcp`, `@lunatest/vitest-plugin`, `@lunatest/playwright-plugin`

## CI / 게이트

- 품질 게이트: `.github/workflows/ci.yml`
- 수동 성능/확장 게이트: `.github/workflows/benchmark.yml`
- 문서 배포: `.github/workflows/docs.yml` (GitHub Pages)
- 릴리스 파이프라인: `.github/workflows/release.yml`
- 릴리스 인증: npm Trusted Publishing(GitHub OIDC, 장기 publish 토큰 미사용)
- CI workspace 품질 명령: `pnpm run build:workspace:ci`, `pnpm run lint:workspace:ci`, `pnpm run test:workspace:ci`
- Dead-code 게이트: 빠른 unused-file 점검은 `pnpm lint:deadcode`, 더 넓은 감사는 `pnpm lint:deadcode:strict`
- `test:e2e:*`는 workspace source integration을 검증하고, 패키지 entrypoint 소비 검증은 `pnpm consumer-smoke:pack`과 `pnpm consumer-smoke:npm`이 담당합니다.
- 패키징된 tarball smoke는 stable 공개 패키지 전체와 React 18/19 peer 호환성을 함께 검증합니다.

## 라이선스

MIT
