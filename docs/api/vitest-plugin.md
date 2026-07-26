# API: @lunatest/vitest-plugin

Release channel: `next`

Install this package explicitly from its prerelease channel:

```bash
pnpm add -D @lunatest/vitest-plugin@next
```

## `createLunaVitestPlugin(options?)`

```ts
type LunaVitestPluginOptions = {
  scenarioDir?: string;
};

type LunaVitestPlugin = {
  name: "lunatest-vitest-plugin";
  scenarioDir: string;
};
```

`createLunaVitestPlugin()` returns metadata for a LunaTest-aware Vitest setup. `scenarioDir` defaults to `"scenarios"`.

```ts
import { createLunaVitestPlugin } from "@lunatest/vitest-plugin";

const luna = createLunaVitestPlugin({ scenarioDir: "scenarios" });
```

The current release does not register Vitest hooks or execute Lua scenarios. Hosts must decide how to consume the returned metadata.

## `toLunaPass(received)`

```ts
type LunaMatcherResult = {
  pass: boolean;
  message: () => string;
};

toLunaPass({ pass: boolean }): LunaMatcherResult;
```

The helper converts a Luna-style result into a Vitest-compatible custom-matcher result. Register it with your test framework if you want assertion syntax; the package does not register matchers globally.
