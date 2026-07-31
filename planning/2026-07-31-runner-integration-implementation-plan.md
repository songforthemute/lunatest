# Runner Integration Graduation Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use test-driven-development for every behavior change.

**Goal:** Make the Vitest and Playwright integrations execute selected Lua scenarios against explicit host adapters, rather than returning metadata or unconditional success.

**Architecture:** Add a Core Node project-runner facade over the existing project loaders and `executeLuaScenario`. The Vitest and Playwright packages depend on that facade, each preserving the host framework's normal lifecycle. Browser validation uses a small real application fixture, while framework packages use structural page/test interfaces so they do not bundle runner dependencies.

**Tech Stack:** TypeScript, Vitest 4, Playwright Test, pnpm 10, GitHub Actions.

---

## Scope Decisions

- Do not implement a Vitest custom runner, automatic Lua test discovery, selector inference, or exact EVM simulation.
- Keep Playwright route helpers. Deprecate, rather than expand, the injected provider test double.
- Keep cross-platform package-consumer smoke unchanged; add browser execution only on Linux.
- Publish changed integrations to `next` first. This implementation does not retag packages as `latest`.

## Task 1: Add Core Project Scenario Execution

**Files:**
- Create: `packages/core/src/project/runner.node.ts`
- Create: `packages/core/src/project/__tests__/runner.node.test.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/CHANGELOG.md`

**Step 1: Write failing lookup and execution tests**

Test one project with `lunatest.config.json`, a root Lua source, and two scenario
sources. Assert that listing returns stable project-relative IDs, a selected exact
ID executes its parsed config through the supplied adapter, and `runAll` retains
source order. Add failing cases for a missing ID and an adapter without
`resolveUi`.

**Step 2: Verify the red state**

Run: `pnpm --filter @lunatest/core test -- runner.node.test.ts`

Expected: FAIL because the project runner does not exist.

**Step 3: Implement the smallest Node-only runner**

Build on `loadLunaProjectConfig`, `loadLunaProjectScenarios`, and
`executeLuaScenario({ source: scenario.config, adapter })`. Preserve source and
ID on each returned result. Resolve only exact project-relative scenario IDs and
throw a named lookup error that includes the requested ID when it is missing.

**Step 4: Verify the focused Core test**

Run: `pnpm --filter @lunatest/core test -- runner.node.test.ts`

Expected: PASS.

**Step 5: Export and document the API**

Export only Node-oriented runner functions and their public types from Core.
Update the Core changelog with the new project execution capability.

**Step 6: Run all Core tests and lint**

Run: `pnpm --filter @lunatest/core test && pnpm --filter @lunatest/core lint`

Expected: PASS.

## Task 2: Turn the Vitest Package Into an Explicit Runner Facade

**Files:**
- Create: `packages/vitest-plugin/src/runner.ts`
- Create: `packages/vitest-plugin/src/watch.ts`
- Modify: `packages/vitest-plugin/src/plugin.ts`
- Modify: `packages/vitest-plugin/src/matchers.ts`
- Modify: `packages/vitest-plugin/src/index.ts`
- Modify: `packages/vitest-plugin/package.json`
- Modify: `packages/vitest-plugin/tsconfig.json`
- Modify: `packages/vitest-plugin/src/__tests__/plugin.test.ts`
- Create: `packages/vitest-plugin/src/__tests__/runner.test.ts`
- Modify: `packages/vitest-plugin/CHANGELOG.md`

**Step 1: Write failing facade tests**

Create a temporary Lua project. Assert that `createLunaVitestPlugin({ cwd })`
lists scenarios, runs a selected scenario through an explicit adapter, and
throws a diff-rich error from `assertScenario` when assertions fail. Assert that
`toLunaPass` includes a provided scenario diff in its message. Assert that the
watch helper produces a caller-scoped pattern and does not mutate global Vitest
configuration.

**Step 2: Verify the red state**

Run: `pnpm --filter @lunatest/vitest-plugin test -- runner.test.ts`

Expected: FAIL because no runner facade or watch helper exists.

**Step 3: Add the Core dependency and project reference**

Add `@lunatest/core` as a workspace runtime dependency and a TypeScript project
reference. Do not import Vitest runtime internals; the facade receives adapters
and is called from normal test bodies.

**Step 4: Implement the minimal facade**

Delegate catalog and execution behavior to Core. Keep `scenarioDir` compatible
with the current option by resolving it relative to the selected working
directory. `assertScenario` must throw a typed error with ID, source, error, and
diff; it must never convert a failure into a passing matcher result.

**Step 5: Implement the explicit watch helper**

Return a `watchTriggerPatterns`-compatible value that maps Lua changes under the
configured scenario directory to caller-supplied harness test files. Normalize
paths for Windows and reject an empty test-file list.

**Step 6: Verify focused and package tests**

Run: `pnpm --filter @lunatest/vitest-plugin test && pnpm --filter @lunatest/vitest-plugin lint`

Expected: PASS.

## Task 3: Add Playwright Page Adapters and Real Commands

**Files:**
- Create: `packages/playwright-plugin/src/adapter.ts`
- Modify: `packages/playwright-plugin/src/commands.ts`
- Modify: `packages/playwright-plugin/src/fixture.ts`
- Modify: `packages/playwright-plugin/src/index.ts`
- Modify: `packages/playwright-plugin/package.json`
- Modify: `packages/playwright-plugin/tsconfig.json`
- Modify: `packages/playwright-plugin/src/__tests__/plugin.test.ts`
- Create: `packages/playwright-plugin/src/__tests__/commands.test.ts`
- Modify: `packages/playwright-plugin/CHANGELOG.md`

**Step 1: Write failing page-adapter tests**

Use a structural fake page and temporary Lua project. Assert that commands list
and execute a selected scenario, call the page adapter in setup/action/read
order, propagate UI assertion failures with the Core diff, and reject an unknown
ID. Assert that `runAll` creates one adapter per scenario rather than sharing
mutable page state.

**Step 2: Verify the red state**

Run: `pnpm --filter @lunatest/playwright-plugin test -- commands.test.ts`

Expected: FAIL because commands always return `{ id, pass: true }`.

**Step 3: Add the Core dependency and reference**

Add `@lunatest/core` as a workspace runtime dependency and TypeScript project
reference. Keep page types structural and do not add `@playwright/test` as a
published runtime dependency.

**Step 4: Implement `createLunaPageAdapter`**

Compose the deterministic Core setup with host callbacks. Require `resolveUi`.
Pass `config`, local scenario runtime, and the page target to the host's
`runWhen`, state, transition, and timing callbacks. Do not infer page selectors
or actions from Lua strings.

**Step 5: Replace placeholder commands**

Add catalog, run, assert, and run-all operations to `createLunaCommands`.
Preserve IDs and source paths in results. Remove the unconditional pass path.

**Step 6: Deprecate the provider stub**

Mark `injectProvider` and its injected test double as deprecated in public types
and runtime documentation. Keep route installation behavior unchanged.

**Step 7: Verify package tests and lint**

Run: `pnpm --filter @lunatest/playwright-plugin test && pnpm --filter @lunatest/playwright-plugin lint`

Expected: PASS.

## Task 4: Add Packed-Consumer and Browser Execution Proof

**Files:**
- Create: `e2e-tests/runner-integration.smoke.test.ts`
- Create: `e2e-tests/playwright/runner-integration.spec.ts`
- Create: `e2e-tests/playwright/fixture-app/index.html`
- Create: `e2e-tests/playwright/fixture-app/main.ts`
- Create: `e2e-tests/playwright.config.ts`
- Modify: `e2e-tests/package.json`
- Modify: `e2e-tests/tsconfig.json`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `scripts/consumer-smoke-fixtures.mjs`
- Modify: `scripts/consumer-smoke-pack.mjs`

**Step 1: Write a failing framework-smoke test**

Run a real temporary project through the public Vitest and Playwright package
exports. Assert a passing scenario and a failing scenario with a useful diff.
This test must not import plugin source files directly.

**Step 2: Verify the red state**

Run: `pnpm --filter @lunatest/e2e-tests test -- runner-integration.smoke.test.ts`

Expected: FAIL because packed exports do not yet execute scenarios.

**Step 3: Add a minimal browser fixture application**

Create an application with deterministic visible state and `data-testid`
selectors. Its test adapter applies Lua state through an explicit page callback,
performs an action, and reads page state. Keep this fixture independent from the
example applications.

**Step 4: Add a Chromium Playwright test**

Verify a successful scenario, an assertion failure carrying the expected diff,
and strict RPC route handling in a real browser. Install Chromium only in the
browser-specific job.

**Step 5: Add the Linux browser CI job**

After `quality`, build the workspace, install Chromium, and run the dedicated
browser command. Do not add browser installation to macOS/Windows consumer jobs.

**Step 6: Extend packed consumer smoke**

Use packed tarballs to load a temporary Lua project and run at least one real
scenario through each runner facade. This verifies published dependencies and
dist exports, not workspace source resolution.

**Step 7: Run focused E2E checks**

Run: `pnpm run test:e2e:smoke:ci && pnpm run test:browser:ci && pnpm consumer-smoke:pack`

Expected: PASS.

## Task 5: Synchronize Public Documentation and Release Metadata

**Files:**
- Modify: `README.md`
- Modify: `README.ko.md`
- Modify: `docs/api/core.md`
- Modify: `docs/ko/api/core.md`
- Modify: `docs/api/vitest-plugin.md`
- Modify: `docs/ko/api/vitest-plugin.md`
- Modify: `docs/api/playwright-plugin.md`
- Modify: `docs/ko/api/playwright-plugin.md`
- Modify: `docs/guides/library-consumption.md`
- Modify: `docs/ko/guides/library-consumption.md`
- Modify: `docs/guides/playwright-routing.md`
- Modify: `docs/ko/guides/playwright-routing.md`
- Create: `.changeset/<generated-name>.md`

**Step 1: Write documentation contract assertions**

Extend the existing docs contract test to reject placeholder claims, require the
explicit adapter prerequisite, and require both language versions to state that
wallet simulation belongs to runtime intercept.

**Step 2: Verify the red state**

Run: `pnpm test:scripts`

Expected: FAIL only on the changed documentation contracts.

**Step 3: Update user-facing guidance**

Show a real one-scenario Vitest example and a Playwright page-adapter example.
Document adapter ownership, failure behavior, watch helper use, the deprecated
provider stub, and the continued `next` channel status. Keep EVM/L4 limitations
explicit in both languages.

**Step 4: Add release metadata**

Add a changeset for Core and both plugin packages. Keep plugin publish tags at
`next`; do not change release scripts or package dist-tags.

**Step 5: Verify documentation**

Run: `pnpm test:scripts && pnpm docs:build`

Expected: PASS.

## Task 6: Full Verification and Review

**Files:**
- Modify only if verification reveals a focused defect.

**Step 1: Run static and package gates**

Run:

```bash
pnpm lint:workspace-types
pnpm lint:deadcode
pnpm -r lint
pnpm exec tsc -b tsconfig.workspace.json --pretty false
pnpm -r build
pnpm -r test
```

**Step 2: Run distribution and release gates**

Run:

```bash
pnpm docs:build
pnpm pack:check-integrity
pnpm consumer-smoke:pack
CI=1 pnpm changeset status --output=./.changeset-status.json
pnpm release:publish:dry-run
```

**Step 3: Inspect the final diff**

Run: `git diff --check origin/main...HEAD && git status --short`

Expected: no whitespace errors and only runner, tests, workflow, docs, planning,
dependency, and changeset files.

**Step 4: Request code review**

Verify the final public behavior against the design record, focusing on false
passes, stale scenario loading, route/provider duplication, and browser-job
cost.
