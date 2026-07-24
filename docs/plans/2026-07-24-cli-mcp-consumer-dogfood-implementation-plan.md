# CLI and MCP Consumer Dogfood Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the published CLI and MCP packages verifiably usable from a fresh external consumer project, with `lunatest-mcp` loading the project's config and Lua scenarios by default.

**Architecture:** Extract config normalization, scenario discovery/catalog loading, and the deterministic runtime adapter from CLI-private modules into a Node-only `@lunatest/core` project loader. Keep CLI behavior stable through thin compatibility wrappers; make the MCP stdio bin use the shared loader and adapter. Exercise both public executables from the packed-tarball consumer smoke, then document the installed-package contract in English and Korean.

**Tech Stack:** TypeScript, Node.js filesystem/process APIs, `tinyglobby`, Vitest, Node test runner, pnpm workspace tarballs, line-delimited JSON-RPC, VitePress.

---

## Scope and invariants

- `lunatest-mcp` requires `lunatest.config.json` in its current working directory by default.
- `lunatest-mcp --config <path>` resolves project-relative config values from the directory containing that config file.
- `lunatest-mcp --empty` is the only intentional no-project mode.
- Project-derived MCP IDs use slash-normalized project-relative paths without `.lua`.
- `scenario.create` and `scenario.mutate` remain in-memory only. Do not add file persistence in this PR.
- Keep Node-only project utilities out of `@lunatest/core/browser`.
- Preserve the existing CLI commands, config shape, output contract, and no-config fallback.

## Task 1: Add a shared Node project loader to core

**Files:**
- Modify `packages/core/package.json`
- Modify `pnpm-lock.yaml`
- Create `packages/core/src/project/config.node.ts`
- Create `packages/core/src/project/scenarios.node.ts`
- Create `packages/core/src/project/__tests__/config.node.test.ts`
- Create `packages/core/src/project/__tests__/scenarios.node.test.ts`
- Modify `packages/core/src/runner/execute-scenario.ts`
- Modify `packages/core/src/runner/__tests__/execute-scenario.test.ts`
- Modify `packages/core/src/index.ts`
- Verify `packages/core/src/browser.ts` remains free of the new exports

1. Add failing Vitest coverage for config selection and normalization.

```ts
const project = await loadLunaProjectConfig({ cwd: fixtureRoot });
expect(project.configPath).toBe(join(fixtureRoot, "lunatest.config.json"));
expect(project.resolvedScenarioDir).toBe(join(fixtureRoot, "scenarios"));

await expect(
  loadLunaProjectConfig({ cwd: missingRoot, requireConfig: true }),
).rejects.toThrow("lunatest.config.json");
```

Cover all of the following before implementation:

- default config at `cwd`
- `--config`-style absolute or relative config path with paths resolved from `dirname(configPath)`
- existing no-config defaults when `requireConfig` is false
- explicit missing config error when `requireConfig` is true
- malformed JSON reports the selected config path
- the existing `coverageCatalog` and `ai` normalization rules are preserved

2. Run the focused test and record the expected RED failure.

```bash
pnpm --filter @lunatest/core test -- project/config.node.test.ts
```

Expected: imports or loader functions are unavailable.

3. Move the normalized config type and loader semantics from `packages/cli/src/config.ts` into `config.node.ts`. The public type must retain the current JSON fields:

```ts
type LunaProjectConfig = {
  scenarioDir: string;
  luaConfigPath: string;
  coverageCatalog?: Partial<CoverageCatalog>;
  ai?: { command: string; args?: string[]; env?: Record<string, string> };
};
```

Return a resolved form containing `cwd`, `projectRoot`, `configPath`, `resolvedScenarioDir`, and `resolvedLuaConfigPath`. Do not import CLI types.

4. Add failing catalog tests. Create a fixture containing `lunatest.lua` and `scenarios/swap.lua`, then assert de-duplicated sorted discovery, parsed name/Lua/config/coverage, and IDs:

```ts
expect(items.map((item) => item.id)).toEqual([
  "lunatest",
  "scenarios/swap",
]);
```

Also cover explicit source/glob errors and assert IDs never contain the temporary absolute directory.

5. Run the focused catalog test and record RED.

```bash
pnpm --filter @lunatest/core test -- project/scenarios.node.test.ts
```

6. Move `tinyglobby` ownership from `@lunatest/cli` to `@lunatest/core`; implement source discovery in `scenarios.node.ts`. Implement `loadLunaProjectScenarios` by reading each source, parsing it with `loadLunaConfig`, resolving coverage with `resolveCoverageMetadata`, and returning a neutral `LunaProjectScenario` record. Normalize copied metadata arrays so callers cannot mutate shared catalog data.

7. Add a failing execution test for a reusable deterministic adapter. Its scenario must set `given`, `intercept.routes`, and `intercept.state`, then pass only if the adapter applies those values before resolving UI/state.

8. Add and export `createDeterministicScenarioAdapter()` from `execute-scenario.ts`. It must match the current CLI `runCommand` semantics exactly:

```ts
runWhen({ config, runtime }) {
  if (config.intercept?.routes) runtime.setRouteMocks(config.intercept.routes);
  if (config.given) runtime.applyInterceptState(config.given);
  if (config.intercept?.state) runtime.applyInterceptState(config.intercept.state);
}
resolveUi({ runtime }) { return runtime.getInterceptState(); }
resolveState({ runtime }) { return runtime.getInterceptState(); }
```

9. Export the Node project types/functions and adapter from `packages/core/src/index.ts`. Do not add them to `browser.ts`; add a source-level assertion if the existing browser-entry tests have a suitable home.

10. Run GREEN checks.

```bash
pnpm --filter @lunatest/core test
pnpm --filter @lunatest/core lint
pnpm --filter @lunatest/core build
```

11. Commit this self-contained change.

```bash
git add packages/core/package.json packages/core/src pnpm-lock.yaml
git commit -m "feat(core): 프로젝트 시나리오 로더 추가"
```

## Task 2: Refactor CLI to the core loader without changing behavior

**Files:**
- Modify `packages/cli/src/config.ts`
- Modify `packages/cli/src/commands/scenario-sources.ts`
- Modify `packages/cli/src/scenario-catalog.ts`
- Modify `packages/cli/src/commands/run.ts`
- Modify `packages/cli/package.json`
- Modify `packages/cli/src/__tests__/cli.test.ts`

1. Add a regression test showing `loadConfig(cwd)` retains the previous no-config fallback and a configured CLI catalog still produces the same coverage and generated-scenario prompts.

2. Run the relevant CLI tests to obtain RED after removing the private duplicate implementation.

```bash
pnpm --filter @lunatest/cli test -- cli.test.ts
```

3. Convert `config.ts` into a compatibility wrapper around `loadLunaProjectConfig({ cwd })`. Preserve the exported CLI names where internal tests use them; alias types rather than redefining the config shape.

4. Replace `scenario-sources.ts` logic with a compatibility re-export/wrapper around `resolveLunaScenarioSources`, and replace catalog parsing with `loadLunaProjectScenarios`. Preserve `ScenarioCatalogEntry` only as a type alias if command call sites still need that name.

5. Replace the inline `runCommand` adapter with `createDeterministicScenarioAdapter()`. Do not change CLI output lines, filtering behavior, watch behavior, or command exit codes.

6. Remove `tinyglobby` from the CLI package manifest only after all imports are gone, then update the lockfile through pnpm.

7. Run GREEN checks.

```bash
pnpm --filter @lunatest/cli test
pnpm --filter @lunatest/cli lint
pnpm --filter @lunatest/cli build
```

8. Commit.

```bash
git add packages/cli/package.json packages/cli/src pnpm-lock.yaml
git commit -m "refactor(cli): 공통 프로젝트 로더 사용"
```

## Task 3: Make the MCP stdio bin config-aware

**Files:**
- Create `packages/mcp/src/bin/mcp-stdio-app.ts`
- Modify `packages/mcp/src/bin/mcp-stdio.ts`
- Create `packages/mcp/src/__tests__/bin.mcp-stdio.test.ts`
- Modify `packages/mcp/src/index.ts` only if public type exports need correction
- Modify `packages/mcp/src/__tests__/transport.stdio.test.ts` only for transport regressions

1. Add failing tests for a testable launcher factory rather than importing the executable module directly. Cover:

- default project startup loads `lunatest.lua` and `scenarios/swap.lua`
- `scenario.list` descriptors expose `lunatest` and `scenarios/swap`, never absolute paths
- `coverage.report` honors explicit catalog gaps and scenario-derived coverage
- `scenario.run` passes with the deterministic adapter
- a config selected from another working directory uses the config file's parent as project root
- missing default config throws a message containing the expected path and `--empty`
- `--empty` creates an empty catalog without requiring a config
- `--help`, unknown flags, missing `--config` value, and `--empty --config` produce deterministic outcomes

2. Run the focused MCP test and record RED.

```bash
pnpm --filter @lunatest/mcp test -- bin.mcp-stdio.test.ts
```

3. Implement `parseMcpStdioArgs(argv)` and a `createProjectMcpServer(...)` factory in `mcp-stdio-app.ts`. Keep argument parsing pure and keep `process.exit` out of the factory so every branch is unit-testable.

4. In project mode, call the core loader with `requireConfig: true`, then construct:

```ts
createMcpServer({
  scenarios: project.scenarios.map(({ id, name, lua, coverage }) => ({
    id,
    name,
    lua,
    coverage,
  })),
  coverageCatalog: project.config.coverageCatalog,
  projectRoot: project.projectRoot,
  scenarioAdapter: createDeterministicScenarioAdapter(),
});
```

Do not add an MCP-to-CLI dependency. Do not persist created or mutated descriptors.

5. Make `mcp-stdio.ts` a thin executable adapter: parse `process.argv.slice(2)`, print help/errors to the correct stream, start the configured server, and retain the existing `runStdioServer` exception reporting.

6. If docs expose `McpServerOptions` or `ScenarioDescriptor` as named API shapes, export their types from the package root and add a type-level package import test. Otherwise, document them structurally without claiming they are named exports.

7. Run GREEN checks, including the pre-existing transport suite.

```bash
pnpm --filter @lunatest/mcp test
pnpm --filter @lunatest/mcp lint
pnpm --filter @lunatest/mcp build
```

8. Commit.

```bash
git add packages/mcp/src
git commit -m "feat(mcp): 설정 기반 stdio 서버 지원"
```

## Task 4: Exercise both executables from packed consumer tarballs

**Files:**
- Create `scripts/consumer-workflow-fixtures.mjs`
- Create `scripts/consumer-workflow-fixtures.test.mjs`
- Modify `scripts/consumer-smoke-pack.mjs`
- Modify `scripts/smoke-helpers.mjs`
- Modify `package.json`

1. Add RED unit tests for pure fixture helpers:

- the generated fixture writes a valid `lunatest.config.json`, a Lua scenario with coverage, and a deterministic AI adapter
- JSON-RPC response correlation preserves numeric/string/null IDs and rejects an unexpected response ID
- command timeout errors include command, stdout, and stderr context

Register the test in `test:scripts`.

2. Implement a deterministic external-consumer project fixture. It must include a missing `approve` target in `coverageCatalog`, so the smoke can prove both covered and missing data rather than just non-empty output.

3. Extend smoke helpers with asynchronous, bounded child-process utilities. The helpers must wait for expected output, capture output continuously, send `SIGINT` for watch shutdown, and force-kill only after a cleanup timeout. Ensure all child cleanup runs in `finally`.

4. In one existing React 19 packed-consumer matrix directory, run and assert the public CLI commands:

```bash
pnpm exec lunatest validate
pnpm exec lunatest run
pnpm exec lunatest coverage
pnpm exec lunatest gen --ai
pnpm exec lunatest watch
```

For watch, assert one initial `Scenario Summary`, modify the scenario file, assert the renamed scenario appears in a second result, then assert clean `SIGINT` termination. For coverage, parse JSON and assert `swap` is covered while `approve` is missing. For generation, assert the expected `.lua` file is created and includes returned metadata.

5. Replace the timeout-only `startMcpSmoke` check with a real JSON-RPC subprocess workflow against `pnpm exec lunatest-mcp`. Write one request per line and assert:

```json
{"id":"list","method":"scenario.list"}
{"id":"run","method":"scenario.run","params":{"id":"scenarios/swap"}}
{"id":"coverage","method":"coverage.report"}
{"id":"gaps","method":"coverage.gaps"}
```

Assert the list contains project-relative IDs, the run passes, coverage includes the explicit catalog, and the gap contains `approve`. Close stdin and assert exit status `0`.

6. Add a targeted `--config` consumer subcase that starts the MCP binary from a sibling directory and proves it loads the fixture config. Add a `--empty` subcase that verifies `scenario.list` is empty. These protect the launcher contract without requiring a second tarball installation.

7. Run GREEN checks.

```bash
pnpm test:scripts
pnpm consumer-smoke:pack
```

8. Commit.

```bash
git add package.json scripts
git commit -m "test(consumer): 패키지 CLI MCP 워크플로 검증"
```

## Task 5: Document the installed-package MCP workflow in both languages

**Files:**
- Create `docs/guides/mcp-stdio.md`
- Modify `docs/ko/guides/mcp-stdio.md`
- Modify `docs/guides/library-consumption.md`
- Modify `docs/ko/guides/library-consumption.md`
- Modify `docs/api/mcp.md`
- Modify `docs/ko/api/mcp.md`
- Modify `docs/.vitepress/config.mts`
- Modify `scripts/docs-site.test.mjs`

1. Add a failing docs-site test requiring both navigation links and both language guides. The test should also reject the former Korean assertion that a bare default server lists an empty scenario catalog.

2. Write the English guide around an installed consumer project, not a workspace `dist` path. Include:

- package install commands
- complete `lunatest.config.json` and Lua fixture
- `pnpm exec lunatest-mcp` default startup and line-delimited JSON-RPC examples
- expected project-relative IDs and a coverage gap
- `--config` for a config outside `cwd`
- `--empty` as generic/legacy mode
- parser/notification/ID rules
- explicit statement that create/mutate are process-memory only

3. Rewrite the Korean guide with the same commands, fields, behavior, error semantics, and persistence boundary. Correct the existing create-then-run example so it supplies valid Lua or states that no Lua produces `scenario_lua_missing`.

4. Add an English navigation entry beside the Korean MCP entry. Update both library-consumption guides and both MCP API pages to link readers to the executable guide and distinguish embedded `createMcpServer` usage from config-aware bin behavior.

5. Run GREEN checks.

```bash
pnpm test:scripts
pnpm docs:build
```

6. Commit.

```bash
git add docs scripts/docs-site.test.mjs
git commit -m "docs(mcp): 설정 기반 stdio 사용법 추가"
```

## Task 6: Add release metadata and perform repository verification

**Files:**
- Create `.changeset/<generated-name>.md`

1. Add a patch changeset for `@lunatest/core`, `@lunatest/cli`, and `@lunatest/mcp`. Describe the core project-loader export, config-aware MCP bin, and consumer-tested CLI/MCP workflow in user-facing terms.

2. Run the focused regression suite first.

```bash
pnpm --filter @lunatest/core test
pnpm --filter @lunatest/cli test
pnpm --filter @lunatest/mcp test
pnpm test:scripts
pnpm consumer-smoke:pack
```

3. Run required repository checks.

```bash
pnpm lint:workspace-types
pnpm lint:deadcode
pnpm -r lint
pnpm exec tsc -b tsconfig.workspace.json --pretty false
pnpm -r build
pnpm -r test
pnpm docs:build
pnpm pack:check-integrity
CI=1 pnpm changeset status --output=./.changeset-status.json
pnpm release:publish:dry-run
```

4. Inspect `git diff --check`, `git status --short`, and the packed consumer output. If a failure is unrelated and pre-existing, capture the exact command and output in the PR body; do not hide it with a broad workflow change.

5. Commit the changeset after verification.

```bash
git add .changeset
git commit -m "chore(release): CLI MCP 소비자 검증 변경 기록"
```

## Completion checklist

- [ ] No duplication remains between CLI and MCP project discovery/execution setup.
- [ ] The default public MCP bin loads a configured consumer project.
- [ ] `--config` and `--empty` behavior is covered by unit and packed-consumer subprocess tests.
- [ ] The consumer smoke proves request/response semantics, not only process survival.
- [ ] CLI no-config behavior and existing commands remain compatible.
- [ ] English and Korean docs describe identical MCP executable behavior.
- [ ] Core browser entry remains free of Node project-loader exports.
- [ ] Changeset and all required checks are green.
