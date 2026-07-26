# API: @lunatest/playwright-plugin

Release channel: `next`

Install this package explicitly from its prerelease channel:

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

`injectProvider(page)` adds a lightweight `window.ethereum` init script. Its `request` method rejects unhandled methods; it is not the full runtime interceptor.

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

## `createLunaCommands()`

```ts
type LunaCommandApi = {
  runScenario(id: string): Promise<{ id: string; pass: boolean }>;
};
```

`createLunaCommands()` is currently an experimental deterministic placeholder: `runScenario(id)` returns `{ id, pass: true }`. It does not load or execute Lua scenarios and must not be used as proof of an end-to-end scenario run.

## Exported types

The package exports `RoutingConfig`, `RoutingMode`, `RpcEndpointRoute`, `HttpEndpointRoute`, `LunaFixture`, `LunaFixtureOptions`, `PlaywrightRouteTarget`, and `InitScriptTarget` for host-side typing.
