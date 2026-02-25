# E2E 0→1 워크스루 (라이브러리 설치 사용자용)

이 문서는 "기존 프론트엔드 앱에 LunaTest를 처음 붙이는 개발자"를 기준으로 작성했습니다.

목표는 하나입니다.

- 앱을 직접 브라우저에서 조작했을 때, 지갑/HTTP/RPC/WebSocket 응답이 우리가 설정한 값으로 들어오는지 확인한다.

## 완료 기준

아래 3가지를 눈으로 확인하면 0→1은 끝입니다.

1. `window.ethereum.request("eth_chainId")` 결과가 설정값(`0x1`)으로 나온다.
2. `fetch("/api/quote")` 응답이 설정한 mock payload로 나온다.
3. WebSocket `send` 이후 설정한 frame 응답이 `message` 이벤트로 들어온다.

## 0) 샘플 프로젝트 준비

```bash
pnpm create vite lunatest-runtime-demo --template react-ts
cd lunatest-runtime-demo
```

## 1) 패키지 설치

```bash
pnpm add @lunatest/runtime-intercept @lunatest/core @lunatest/react
```

핵심은 `@lunatest/runtime-intercept`입니다.
`core/react`는 앱과 함께 붙였을 때 실제 사용 흐름을 바로 확인하려고 같이 넣습니다.

## 2) `lunatest.config.ts` 작성 (앱 루트)

```ts
import type { LunaRuntimeInterceptConfig } from "@lunatest/runtime-intercept";

const config: LunaRuntimeInterceptConfig = {
  enable: undefined,
  debug: true,
  intercept: {
    mode: "strict",
    routing: {
      ethereumMethods: [
        { method: "eth_chainId", responseKey: "wallet.chainId" },
        { method: "eth_accounts", responseKey: "wallet.accounts" },
      ],
      rpcEndpoints: [{ urlPattern: "**/rpc", methods: ["eth_call"], responseKey: "rpc.call" }],
      httpEndpoints: [{ urlPattern: "**/api/quote", method: "GET", responseKey: "api.quote" }],
      wsEndpoints: [
        {
          urlPattern: "ws://localhost:8787/stream",
          match: "SUBSCRIBE_QUOTE",
          responseKey: "ws.quote",
        },
      ],
    },
    mockResponses: {
      "wallet.chainId": { result: "0x1" },
      "wallet.accounts": { result: ["0x1111111111111111111111111111111111111111"] },
      "rpc.call": { result: "0x01" },
      "api.quote": {
        status: 200,
        body: {
          amountOut: "123.45",
          priceImpactBps: 12,
        },
      },
      "ws.quote": {
        type: "QUOTE_UPDATED",
        payload: {
          amountOut: "123.40",
        },
      },
    },
  },
};

export default config;
```

## 3) 엔트리 파일에 1줄 추가 (`src/main.tsx`)

```ts
import config from "../lunatest.config";
import { enableLunaRuntimeIntercept } from "@lunatest/runtime-intercept";

enableLunaRuntimeIntercept(config);
```

여기서 중요한 규칙:

- `enable`이 있으면 그 값이 최우선
- `enable`이 없으면 `NODE_ENV === "development"`일 때만 활성화

## 4) 화면에서 직접 확인할 버튼 추가 (`src/App.tsx`)

```tsx
import { useState } from "react";

type CheckResult = {
  chainId?: string;
  accounts?: string[];
  quote?: unknown;
  wsFrames: unknown[];
};

export default function App() {
  const [result, setResult] = useState<CheckResult>({ wsFrames: [] });

  async function runChecks() {
    const ethereum = (window as Window & { ethereum?: { request: (input: unknown) => Promise<unknown> } })
      .ethereum;

    const chainId = ethereum
      ? ((await ethereum.request({ method: "eth_chainId" })) as string)
      : "no-ethereum";

    const accounts = ethereum
      ? ((await ethereum.request({ method: "eth_accounts" })) as string[])
      : [];

    const quote = await fetch("http://localhost:5173/api/quote", {
      method: "GET",
    }).then((response) => response.json());

    const wsFrames: unknown[] = [];
    const ws = new WebSocket("ws://localhost:8787/stream");
    ws.addEventListener("message", (event) => {
      try {
        wsFrames.push(JSON.parse(event.data));
      } catch {
        wsFrames.push(event.data);
      }
      setResult((prev) => ({ ...prev, wsFrames: [...wsFrames] }));
      ws.close();
    });

    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "SUBSCRIBE_QUOTE" }));
    });

    setResult({ chainId, accounts, quote, wsFrames });
  }

  return (
    <main style={{ fontFamily: "sans-serif", padding: 24 }}>
      <h1>LunaTest Runtime Intercept 0→1</h1>
      <button onClick={runChecks}>Run Checks</button>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </main>
  );
}
```

## 5) 개발 서버 실행

```bash
pnpm dev
```

브라우저에서 `Run Checks`를 누르면 `pre` 블록에 아래와 비슷한 결과가 나옵니다.

```json
{
  "chainId": "0x1",
  "accounts": ["0x1111111111111111111111111111111111111111"],
  "quote": {
    "amountOut": "123.45",
    "priceImpactBps": 12
  },
  "wsFrames": [
    {
      "type": "QUOTE_UPDATED",
      "payload": {
        "amountOut": "123.40"
      }
    }
  ]
}
```

이 화면이 나오면, 런타임 인터셉트가 지갑/프로토콜 통신 모두 잡고 있다는 뜻입니다.

## 6) 실패 시 먼저 볼 체크포인트

- `strict` 모드에서 라우팅 누락이 있으면 요청이 바로 차단됩니다.
- `urlPattern`, `method`, `responseKey` 오타를 가장 먼저 확인하세요.
- WebSocket은 `urlPattern`과 `match`가 동시에 맞아야 합니다.
- 콘솔에 `[lunatest:runtime-intercept]` 로그가 안 보이면 `debug: true` 여부를 확인하세요.

## 7) 다음 단계

- 현재 예제를 프로젝트 도메인 API/WS 엔드포인트로 치환
- `strict`를 유지한 채 필수 경로만 점진적으로 등록
- 이후 Playwright smoke 테스트로 같은 응답 계약을 CI에서 재검증
