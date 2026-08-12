# API: @lunatest/playwright-plugin

Release channel: `latest`

Install the Playwright integration as a development dependency:

```bash
pnpm add -D @lunatest/playwright-plugin
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

`injectProvider(page)` adds a lightweight `window.ethereum` init script. Its `request` method rejects unhandled methods; it is not the full runtime interceptor. This method is deprecated: bootstrap `@lunatest/runtime-intercept` in the application when a test needs deterministic wallet behavior.

`installRouting(page)` registers one catch-all route and resolves configured RPC and HTTP endpoint mocks. In `strict` mode an endpoint whose response is missing is aborted. In `permissive` mode, which is the default, it continues to the network.

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

`createLunaCommands` loads the project catalog described by `lunatest.config.json`. Scenario IDs are exact project-relative paths such as `scenarios/quote-ready`. `runScenario` returns failed executions without throwing. `assertScenario` throws `LunaCommandAssertionError` with the scenario id, source, error, and diff when present.

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

The adapter first applies Luna's deterministic scenario state, then calls the host's `runWhen`. `resolveUi` is required and reads the application's real page state. LunaTest does not infer selectors or actions from Lua.

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

## Exported types

The package exports `LunaCommandApi`, `LunaCommandOptions`, `LunaCommandScenarioAdapter`, `LunaCommandScenarioExecution`, `LunaPageAdapterOptions`, `LunaPageScenarioContext`, `RoutingConfig`, `RoutingMode`, `RpcEndpointRoute`, `HttpEndpointRoute`, `LunaFixture`, `LunaFixtureOptions`, `PlaywrightRouteTarget`, and `InitScriptTarget` for host-side typing.
