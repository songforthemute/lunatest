# Playwright 라우팅 모킹 가이드

LunaTest Playwright 플러그인은 두 축을 같이 처리합니다.

- 지갑 주입: `injectProvider`
- 네트워크 모킹: `installRouting`

## 핵심 포인트

- `rpcEndpoints` 배열: JSON-RPC 엔드포인트와 메서드별 응답 매핑
- `httpEndpoints` 배열: 백엔드 API 응답 매핑
- `mode: "strict"`: 매핑되지 않은 요청은 차단
- `mode: "permissive"`: 매핑되지 않은 요청은 통과

## 예시

```ts
import { test } from "@playwright/test";
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
  await luna.injectProvider(page);
  await luna.installRouting(page);

  await page.goto("http://localhost:3000");
  // ... 테스트 시나리오 진행
});
```

## 배열 기반 라우팅이 유리한 이유

- RPC 노드 상호작용과 백엔드 API를 같은 테스트에서 함께 제어할 수 있습니다.
- 시나리오별로 endpoint 배열만 바꿔서 재사용하기 쉽습니다.
- strict 모드로 누락된 네트워크 호출을 빠르게 잡을 수 있습니다.
