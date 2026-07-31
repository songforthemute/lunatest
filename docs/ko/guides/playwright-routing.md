# Playwright 라우팅 모킹 가이드

LunaTest Playwright 플러그인은 아래 두 축을 함께 처리합니다.

- 지갑 주입: `injectProvider` (deprecated test double)
- 네트워크 모킹: `installRouting`

## 핵심 포인트

- `rpcEndpoints` 배열: JSON-RPC 엔드포인트와 메서드별 응답 매핑
- `httpEndpoints` 배열: 백엔드 API 응답 매핑
- `mode: "strict"`: 매핑되지 않은 요청 차단
- `mode: "permissive"`: 매핑되지 않은 요청 통과

## 예시

```ts
import { expect, test } from "@playwright/test";
import { createLunaFixture } from "@lunatest/playwright-plugin";

const luna = createLunaFixture({
  routing: {
    mode: "strict",
    rpcEndpoints: [
      { urlPattern: "**/rpc", methods: ["eth_chainId"], responseKey: "rpc.chainId" },
      { urlPattern: "**/rpc", methods: ["eth_call"], responseKey: "rpc.call" },
    ],
    httpEndpoints: [
      { urlPattern: "**/api/quote", method: "GET", responseKey: "api.quote" },
      { urlPattern: "**/api/swap", method: "POST", responseKey: "api.swap" },
    ],
  },
  mockResponses: {
    "rpc.chainId": { result: "0x1" },
    "rpc.call": { result: "0x0000000000000000000000000000000000000000000000000000000000000001" },
    "api.quote": { status: 200, body: { amountOut: "123.45", priceImpactBps: 12 } },
    "api.swap": { status: 200, body: { txHash: "0xabc" } },
  },
});

test("swap flow", async ({ page }) => {
  await luna.installRouting(page);

  await page.goto("http://localhost:3000");
  // ... 테스트 시나리오 진행
});
```

## 배열 기반 라우팅이 유리한 이유

- RPC 노드 상호작용과 백엔드 API를 같은 테스트에서 함께 제어할 수 있습니다.
- 시나리오별로 endpoint 배열만 바꿔 재사용하기 쉽습니다.
- strict 모드로 누락된 네트워크 호출을 빠르게 잡을 수 있습니다.

`injectProvider`는 처리되지 않은 EIP-1193 모양의 test double만 추가합니다. 결정론적인 wallet method가 필요하면 애플리케이션에서 runtime intercept를 bootstrap하세요.

## 실제 Page에 Lua Scenario 실행

`createLunaCommands`는 `lunatest.config.json` project를 로드하고 정확한 project-relative ID를 해석합니다. `createLunaPageAdapter`는 명시적인 callback으로 host action을 실행하고 실제 page state를 읽습니다.

```ts
import { createLunaCommands, createLunaPageAdapter } from "@lunatest/playwright-plugin";

const commands = createLunaCommands({ cwd: process.cwd() });

test("quote-ready를 검증한다", async ({ page }) => {
  await page.goto("http://localhost:3000");

  const execution = await commands.assertScenario(
    "scenarios/quote-ready",
    createLunaPageAdapter({
      page,
      runWhen: ({ page: target }) => target.getByTestId("load-quote").click(),
      resolveUi: async ({ page: target }) => ({
        quote: { status: await target.getByTestId("quote-status").textContent() },
      }),
    }),
  );

  expect(execution.execution.pass).toBe(true);
});
```

adapter는 먼저 결정론 scenario state를 적용한 뒤 `runWhen`을 호출합니다. LunaTest는 Lua `when` field에서 selector나 browser action을 추론하지 않습니다.
