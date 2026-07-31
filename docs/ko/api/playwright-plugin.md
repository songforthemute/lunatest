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

`injectProvider(page)`은 가벼운 `window.ethereum` init script를 추가합니다. 처리하지 않은 `request` method는 reject하며, full runtime interceptor는 아닙니다. 이 method는 deprecated입니다. 테스트에 결정론적인 wallet 동작이 필요하면 애플리케이션에서 `@lunatest/runtime-intercept`를 bootstrap하세요.

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

## `createLunaCommands(options?)`

```ts
type LunaCommandOptions = {
  cwd?: string;
  configPath?: string;
  scenarioDir?: string;
};

type LunaCommandApi = {
  listScenarios(): Promise<LunaProjectScenario[]>;
  runScenario(id: string, adapter: ExecuteLuaScenarioAdapter): Promise<LunaProjectScenarioExecution>;
  assertScenario(id: string, adapter: ExecuteLuaScenarioAdapter): Promise<LunaProjectScenarioExecution>;
  runAll(createAdapter: (scenario: LunaProjectScenario) => ExecuteLuaScenarioAdapter): Promise<LunaProjectScenarioExecution[]>;
};
```

`createLunaCommands`는 `lunatest.config.json`이 설명하는 project catalog를 로드합니다. scenario ID는 `scenarios/quote-ready` 같은 정확한 project-relative path입니다. `runScenario`는 실패 execution을 반환하고, `assertScenario`는 scenario id, source, error, 가능한 경우 diff를 담은 `LunaCommandAssertionError`를 throw합니다.

## `createLunaPageAdapter(options)`

```ts
type LunaPageAdapterOptions<Page> = {
  page: Page;
  runWhen?: (context: { page: Page; config: LuaConfig; runtime: ScenarioRuntime }) => void | Promise<void>;
  resolveUi: (context: { page: Page; config: LuaConfig; runtime: ScenarioRuntime }) => Record<string, unknown> | Promise<Record<string, unknown>>;
  resolveState?: (context: { page: Page; config: LuaConfig; runtime: ScenarioRuntime }) => Record<string, unknown> | Promise<Record<string, unknown>>;
  resolveTransitions?: (context: { page: Page; config: LuaConfig; runtime: ScenarioRuntime }) => string[] | Promise<string[]>;
  resolveElapsedMs?: (context: { page: Page; config: LuaConfig; runtime: ScenarioRuntime }) => number | Promise<number>;
};
```

adapter는 먼저 Luna의 결정론 scenario state를 적용한 뒤 host의 `runWhen`을 호출합니다. `resolveUi`는 필수이며 애플리케이션의 실제 page state를 읽습니다. LunaTest는 Lua에서 selector나 action을 추론하지 않습니다.

```ts
import { createLunaCommands, createLunaPageAdapter } from "@lunatest/playwright-plugin";

const luna = createLunaCommands({ cwd: process.cwd() });

const execution = await luna.assertScenario(
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

## Exported type

호스트 타입 지정을 위해 `LunaCommandApi`, `LunaCommandOptions`, `LunaCommandScenarioAdapter`, `LunaCommandScenarioExecution`, `LunaPageAdapterOptions`, `LunaPageScenarioContext`, `RoutingConfig`, `RoutingMode`, `RpcEndpointRoute`, `HttpEndpointRoute`, `LunaFixture`, `LunaFixtureOptions`, `PlaywrightRouteTarget`, `InitScriptTarget`을 export합니다.
