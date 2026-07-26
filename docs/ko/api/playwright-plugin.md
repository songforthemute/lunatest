# API: @lunatest/playwright-plugin

배포 채널: `next`

이 패키지는 prerelease 채널이므로 설치 시 태그를 명시합니다.

```bash
pnpm add -D @lunatest/playwright-plugin@next
```

## `createLunaFixture(options?)`

```ts
type LunaFixtureOptions = {
  routing?: {
    mode?: "strict" | "permissive";
    rpcEndpoints?: RpcEndpointRoute[];
    httpEndpoints?: HttpEndpointRoute[];
  };
  mockResponses?: Record<string, unknown | ((context) => unknown | Promise<unknown>)>;
};

type LunaFixture = {
  injectProvider(target?: InitScriptTarget): Promise<void>;
  installRouting(target: PlaywrightRouteTarget): Promise<void>;
};
```

`injectProvider(page)`은 가벼운 `window.ethereum` init script를 추가합니다. 처리하지 않은 `request` method는 reject하며, full runtime interceptor는 아닙니다.

`installRouting(page)`은 catch-all route 하나를 등록하고 구성된 RPC/HTTP endpoint mock을 해석합니다. `strict`에서는 response가 없는 endpoint를 abort합니다. 기본값인 `permissive`에서는 network로 계속 보냅니다.

```ts
import { createLunaFixture } from "@lunatest/playwright-plugin";

const luna = createLunaFixture({
  routing: {
    mode: "strict",
    rpcEndpoints: [{ urlPattern: "https://rpc.example.test", responseKey: "chainId" }],
  },
  mockResponses: { chainId: { result: "0x1" } },
});

await luna.injectProvider(page);
await luna.installRouting(page);
```

## `createLunaCommands()`

```ts
type LunaCommandApi = {
  runScenario(id: string): Promise<{ id: string; pass: boolean }>;
};
```

`createLunaCommands()`는 현재 experimental deterministic placeholder입니다. `runScenario(id)`는 `{ id, pass: true }`를 반환하며 Lua scenario를 읽거나 실행하지 않습니다. 따라서 end-to-end scenario 실행의 증거로 사용하면 안 됩니다.

## Exported type

호스트 타입 지정을 위해 `RoutingConfig`, `RoutingMode`, `RpcEndpointRoute`, `HttpEndpointRoute`, `LunaFixture`, `LunaFixtureOptions`, `PlaywrightRouteTarget`, `InitScriptTarget`을 export합니다.
