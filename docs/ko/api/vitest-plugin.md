# API: @lunatest/vitest-plugin

배포 채널: `latest`

```bash
pnpm add -D @lunatest/vitest-plugin
```

`@lunatest/vitest-plugin`은 명시적인 adapter를 통해 구성된 LunaTest 프로젝트를 실행합니다. 전역 matcher를 등록하지 않고, UI action을 추론하지 않으며, Vitest 자체 runner lifecycle을 대체하지 않습니다.

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

`listScenarios()`는 `lunatest.config.json`과 project catalog를 로드합니다. ID는 `scenarios/quote-ready` 같은 정확한 project-relative path입니다. `runScenario()`는 실패한 경우에도 executor result를 반환합니다. `assertScenario()`는 실패 시 scenario id, source, error, 가능한 경우 diff를 담은 `LunaVitestScenarioAssertionError`를 throw합니다.

`runAll()`은 catalog order를 보존하고 scenario를 순차 실행합니다. 따라서 adapter가 browser page나 mutable host target을 재사용할 수 있습니다.

```ts
import { expect, it } from "vitest";
import { createLunaVitestRunner, toLunaPass } from "@lunatest/vitest-plugin";

expect.extend({ toLunaPass });

const luna = createLunaVitestRunner({ cwd: process.cwd() });

it("quote를 로드한다", async () => {
  const execution = await luna.assertScenario("scenarios/quote-ready", {
    runWhen: () => clickQuoteButton(),
    resolveUi: () => ({ quote: { status: readQuoteStatus() } }),
  });

  expect(execution.execution).toLunaPass();
});
```

adapter contract는 `@lunatest/core`에서 옵니다. `resolveUi`는 UI assertion의 host source of truth이며, Lua scenario에서 사용하는 경우에만 `resolveState`, `resolveTransitions`, `resolveElapsedMs`를 제공합니다.

## `createLunaVitestPlugin(options?)`

`createLunaVitestPlugin`은 같은 runner API에 stable integration metadata를 더해 반환합니다.

```ts
type LunaVitestPlugin = LunaVitestRunner & {
  name: "lunatest-vitest-plugin";
  scenarioDir: string;
};
```

harness에 runner method와 구성된 scenario directory가 모두 필요할 때 사용합니다. facade 생성 시 `lunatest.config.json`을 동기로 읽으므로 `scenarioDir`에는 구성된 directory가 반영되며, 명시적인 `scenarioDir` option이 있으면 그 값이 우선합니다.

## `createLunaVitestWatchTrigger(options)`

```ts
type LunaVitestWatchTriggerOptions = {
  cwd?: string;
  configPath?: string;
  scenarioDir?: string;
  root?: string;
  testFiles: string[];
};

type LunaVitestWatchTrigger = {
  pattern: RegExp;
  testsToRun(id: string): string[];
};
```

결과를 Vitest의 `watchTriggerPatterns`에 전달하면 `.lua` 수정 시 명시적인 harness test를 다시 실행합니다. helper는 `lunatest.config.json`을 동기로 해석하므로 명시적인 `scenarioDir` override가 없으면 구성된 directory를 감시합니다. `cwd`는 LunaTest project config 탐색 기준이고, `root`는 상대 watched-file ID를 만드는 Vitest root이며 기본값은 `cwd`입니다. pattern은 그 상대 ID와 Vitest 4 watcher가 전달하는 POSIX 절대 ID를 모두 받습니다. harness test file은 최소 하나가 필요합니다.

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

이 helper는 Luna execution result를 Vitest custom matcher result로 변환합니다. `expect.extend`로 직접 등록해야 하며 패키지가 Vitest 전역 상태를 변경하지 않습니다.
