# API: @lunatest/vitest-plugin

Release channel: `next`

```bash
pnpm add -D @lunatest/vitest-plugin@next
```

`@lunatest/vitest-plugin` executes a configured LunaTest project through explicit
adapters. It does not register global matchers, infer UI actions, or replace
Vitest's own runner lifecycle.

## `createLunaVitestRunner(options?)`

```ts
type LunaVitestRunnerOptions = {
  cwd?: string;
  configPath?: string;
  scenarioDir?: string;
};

type LunaVitestRunner = {
  listScenarios(): Promise<LunaProjectScenario[]>;
  runScenario(id: string, adapter: ExecuteLuaScenarioAdapter): Promise<LunaProjectScenarioExecution>;
  assertScenario(id: string, adapter: ExecuteLuaScenarioAdapter): Promise<LunaProjectScenarioExecution>;
  runAll(createAdapter: (scenario: LunaProjectScenario) => ExecuteLuaScenarioAdapter): Promise<LunaProjectScenarioExecution[]>;
};
```

`listScenarios()` loads `lunatest.config.json` and the project catalog. IDs are
exact project-relative paths such as `scenarios/quote-ready`. `runScenario()`
returns the executor result even when it fails. `assertScenario()` throws
`LunaVitestScenarioAssertionError` on a failed result, including the scenario
id, source, error, and diff when available.

`runAll()` preserves catalog order and executes scenarios sequentially. An
adapter may therefore reuse a browser page or another mutable host target.

```ts
import { expect, it } from "vitest";
import { createLunaVitestRunner, toLunaPass } from "@lunatest/vitest-plugin";

expect.extend({ toLunaPass });

const luna = createLunaVitestRunner({ cwd: process.cwd() });

it("loads a quote", async () => {
  const execution = await luna.assertScenario("scenarios/quote-ready", {
    runWhen: () => clickQuoteButton(),
    resolveUi: () => ({ quote: { status: readQuoteStatus() } }),
  });

  expect(execution.execution).toLunaPass();
});
```

The adapter contract comes from `@lunatest/core`. `resolveUi` is the host's
source of truth for UI assertions; `resolveState`, `resolveTransitions`, and
`resolveElapsedMs` are optional when the Lua scenario uses those assertions.

## `createLunaVitestPlugin(options?)`

`createLunaVitestPlugin` returns the same runner API plus stable integration
metadata:

```ts
type LunaVitestPlugin = LunaVitestRunner & {
  name: "lunatest-vitest-plugin";
  scenarioDir: string;
};
```

Use it when a harness needs both runner methods and the configured scenario
directory. It reads `lunatest.config.json` synchronously when the facade is
created, so `scenarioDir` reflects the configured directory; an explicit
`scenarioDir` option takes precedence.

## `createLunaVitestWatchTrigger(options)`

```ts
type LunaVitestWatchTriggerOptions = {
  cwd?: string;
  configPath?: string;
  scenarioDir?: string;
  testFiles: string[];
};

type LunaVitestWatchTrigger = {
  pattern: RegExp;
  testsToRun(id: string): string[];
};
```

Pass the result to Vitest's `watchTriggerPatterns` so edits to `.lua` files
rerun an explicit harness test. The helper resolves `lunatest.config.json`
synchronously, so it watches the configured directory unless an explicit
`scenarioDir` override is supplied. At least one harness test file is required.

```ts
import { defineConfig } from "vitest/config";
import { createLunaVitestWatchTrigger } from "@lunatest/vitest-plugin";

const lunaScenarios = createLunaVitestWatchTrigger({
  testFiles: ["tests/luna-scenarios.test.ts"],
});

export default defineConfig({
  test: { watchTriggerPatterns: [lunaScenarios] },
});
```

## `toLunaPass(received)`

```ts
type LunaMatcherInput = {
  pass: boolean;
  error?: string;
  diff?: string;
  result?: { diff?: string };
};

toLunaPass(received: LunaMatcherInput): {
  pass: boolean;
  message(): string;
};
```

The helper converts a Luna execution result into a Vitest custom matcher
result. Register it with `expect.extend`; the package never mutates Vitest
global state itself.
