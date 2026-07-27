# Documentation Integrity Remediation Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the published LunaTest documentation accurately describe the current npm release channels, public API surface, CLI workflow, and bilingual support matrix without changing package runtime behavior.

**Architecture:** Treat the package roster, `src/index.ts` exports, CLI command registration, and root CI scripts as the documentation contracts. Add focused Node tests that assert those contracts against the user-facing docs, then update the docs and VitePress navigation to satisfy them. Preserve historical design records outside the VitePress source tree so published Pages contains only maintained user documentation.

**Tech Stack:** Markdown, VitePress 1.6, Node.js `node:test`, pnpm 10, npm dist-tags.

---

## Scope Decisions

- Keep `@lunatest/vitest-plugin` and `@lunatest/playwright-plugin` on the `next` channel. Consumer installation examples must use `@next`; this PR does not publish packages or alter npm tags.
- Document every public package and all currently exported user-facing helpers. Do not claim that `createLunaCommands()` executes Lua scenarios or that the Vitest helper provides hooks it does not implement.
- Keep runtime, CLI, MCP, React, and plugin code unchanged. Any stabilization of the next-channel plugin behavior is a follow-up product task.
- Move the historical PRD and implementation plans out of the VitePress `docs` source tree while preserving repository history with `git mv`.

## Task 1: Establish Documentation Contract Tests

**Files:**
- Create: `scripts/docs-contracts.test.mjs`
- Modify: `package.json`
- Test: `scripts/docs-contracts.test.mjs`

**Step 1: Write failing contract tests for release-channel install snippets**

Import `nextPackages` from `scripts/package-roster.mjs`. Read the English/Korean README, Getting Started, and Library Consumption documents. Assert both next-channel package names appear with `@next` in every consumer installation snippet.

**Step 2: Run the new test to verify it fails**

Run: `pnpm exec node --test scripts/docs-contracts.test.mjs`

Expected: FAIL because current installation snippets omit `@next`.

**Step 3: Add contract tests for public docs inventory**

Assert these API documents exist in both languages:

```text
docs/api/contracts.md
docs/api/core.md
docs/api/runtime-intercept.md
docs/api/cli.md
docs/api/mcp.md
docs/api/react.md
docs/api/vitest-plugin.md
docs/api/playwright-plugin.md
docs/ko/api/contracts.md
docs/ko/api/core.md
docs/ko/api/runtime-intercept.md
docs/ko/api/cli.md
docs/ko/api/mcp.md
docs/ko/api/react.md
docs/ko/api/vitest-plugin.md
docs/ko/api/playwright-plugin.md
```

Read `packages/cli/src/cli.ts` and assert its registered command names (`run`, `validate`, `watch`, `coverage`, `gen`, `devtools`, `doctor`) are named in both CLI API documents. Assert the Core API documents mention `loadLunaProjectConfig`, `loadLunaProjectScenarios`, `resolveLunaScenarioSources`, `applyInterceptState`, `setRouteMocks`, and `createDeterministicScenarioAdapter`.

**Step 4: Add contract tests for documentation boundaries and navigation**

Assert the VitePress config links to every API page above and to the English/Korean counterpart guides introduced by this plan. Assert `docs/PRD.md` and `docs/plans` no longer exist; assert their archival replacements exist under `planning/`.

**Step 5: Register the test in the root script suite**

Append `scripts/docs-contracts.test.mjs` to `test:scripts`. Keep the existing docs-site tests unchanged; the new file owns release/API/parity contract assertions.

**Step 6: Run the test to verify the intended red state**

Run: `pnpm exec node --test scripts/docs-contracts.test.mjs`

Expected: FAIL only on missing API pages, absent `@next` snippets, incomplete CLI/Core coverage, and currently published historical sources.

**Step 7: Commit the test scaffold**

```bash
git add package.json scripts/docs-contracts.test.mjs
git commit -m "test(docs): 문서 계약 검증 추가"
```

## Task 2: Remove Historical Records From the Published Docs Source

**Files:**
- Create: `planning/README.md`
- Move: `docs/PRD.md` to `planning/archive/PRD.md`
- Move: `docs/plans/` to `planning/archive/plans/`
- Modify: `scripts/build-docs-site.mjs`
- Modify: `scripts/docs-site.test.mjs`
- Test: `scripts/docs-contracts.test.mjs`, `scripts/docs-site.test.mjs`

**Step 1: Move historical documents without rewriting their contents**

Use `git mv` to preserve history. Keep all existing dated plans together under `planning/archive/plans/`, including this implementation-plan document once execution begins. Move the legacy PRD to `planning/archive/PRD.md`.

**Step 2: Add an archive boundary README**

Create `planning/README.md` stating that this tree contains historical design and execution records, is not part of the public VitePress documentation site, and must not be used as a current API or behavior reference.

**Step 3: Make the docs build reject historical output**

In `scripts/build-docs-site.mjs`, after VitePress build and before copying the live demo artifacts, fail if `docs/.vitepress/dist/PRD.html` or `docs/.vitepress/dist/plans/` exists. The error must name the forbidden artifact.

**Step 4: Extend docs-site coverage for the build boundary**

Update `scripts/docs-site.test.mjs` to assert that the build script contains both historical artifact checks. Do not assert old `docs/plans` source paths.

**Step 5: Run focused tests**

Run: `pnpm exec node --test scripts/docs-contracts.test.mjs scripts/docs-site.test.mjs`

Expected: PASS after the moves and boundary checks are complete.

**Step 6: Commit the archival change**

```bash
git add docs planning scripts/build-docs-site.mjs scripts/docs-site.test.mjs
git commit -m "docs(site): 과거 계획 문서 배포 제외"
```

## Task 3: Correct Release-Channel and CI Command Documentation

**Files:**
- Modify: `README.md`
- Modify: `README.ko.md`
- Modify: `docs/getting-started.md`
- Modify: `docs/ko/getting-started.md`
- Modify: `docs/guides/library-consumption.md`
- Modify: `docs/ko/guides/library-consumption.md`
- Modify: `docs/guides/ci-integration.md`
- Create: `docs/ko/guides/ci-integration.md`
- Test: `scripts/docs-contracts.test.mjs`

**Step 1: Update next-channel installation commands**

Change all consumer install snippets for the plugin packages to:

```bash
pnpm add -D @lunatest/vitest-plugin@next @lunatest/playwright-plugin@next
```

Where only one plugin is installed, retain the same package selection and add only its `@next` tag. Explain that untagged installs resolve the older `latest` channel and that `next` is intentionally experimental.

**Step 2: Separate local commands from fresh-checkout CI commands**

Retain plain `test:e2e:smoke` and `test:e2e:extended` only as explicitly labeled local commands that require an already-built workspace. Use `test:e2e:smoke:ci`, `test:e2e:extended:ci`, `perf:regression:ci`, and `perf:absolute:ci` for PR/nightly examples.

**Step 3: Correct performance examples**

Remove `--threshold=5` from the Korean Getting Started guide. State the real fixed absolute thresholds: p95 below 1 ms and 1,000 scenarios below 1 second. Use the CI wrappers in CI examples; if keeping direct local runner examples, state that `build:workspace:ci` must be run first.

**Step 4: Translate the English CI guide**

Convert `docs/guides/ci-integration.md` to English without changing its workflow facts. Create a Korean counterpart that carries the same wrapper, platform, release, and supply-chain guidance.

**Step 5: Run the documentation contracts**

Run: `pnpm exec node --test scripts/docs-contracts.test.mjs`

Expected: PASS for release-channel and CLI/CI command contracts.

**Step 6: Commit the onboarding correction**

```bash
git add README.md README.ko.md docs/getting-started.md docs/ko/getting-started.md docs/guides
git commit -m "docs(onboarding): 채널과 CI 명령 정합화"
```

## Task 4: Complete the API Reference Surface

**Files:**
- Create: `docs/api/contracts.md`
- Create: `docs/api/vitest-plugin.md`
- Create: `docs/api/playwright-plugin.md`
- Create: `docs/ko/api/contracts.md`
- Create: `docs/ko/api/cli.md`
- Create: `docs/ko/api/vitest-plugin.md`
- Create: `docs/ko/api/playwright-plugin.md`
- Modify: `docs/api/cli.md`
- Modify: `docs/api/core.md`
- Modify: `docs/ko/api/core.md`
- Modify: `docs/.vitepress/config.mts`
- Test: `scripts/docs-contracts.test.mjs`

**Step 1: Add the missing package references**

Document `@lunatest/contracts` as the shared type package, including routing, route mock, coverage, wallet-session, and preset metadata types. Clarify that application consumers normally import higher-level helpers from Core/React/runtime-intercept and use Contracts when they need shared type annotations.

Document `@lunatest/vitest-plugin` with the exact `createLunaVitestPlugin({ scenarioDir? })` return behavior and `toLunaPass({ pass })` matcher contract. Mark the package `next` channel and avoid claiming automatic scenario discovery or execution hooks.

Document `@lunatest/playwright-plugin` with `createLunaFixture`, `injectProvider`, `installRouting`, routing/mocking types, and `createLunaCommands`. Explicitly mark `createLunaCommands` experimental and explain that its current result is a deterministic placeholder, not a Lua execution adapter.

**Step 2: Translate and complete the CLI reference**

Translate the existing English-path CLI page into English. Add its Korean counterpart. Both pages must include `validate`, `--scenario`, the default source set, watch debounce/polling behavior, coverage output, the AI adapter stdin/stdout contract, generated scenario validation/run behavior, devtools, and doctor output.

**Step 3: Add missing Core API shapes**

In both Core references, add `loadLunaProjectConfig`, `loadLunaProjectScenarios`, `resolveLunaScenarioSources`, `applyInterceptState`, `setRouteMocks`, and `createDeterministicScenarioAdapter`. Show the project config defaults/resolved-path semantics and `ExecuteLuaScenarioInput`/result shape without inventing implementation details.

**Step 4: Update API navigation and cross-links**

Add all eight API pages to the English and Korean sidebars. Add a package-channel link from each plugin API page to the Release Channels section of the README or Library Consumption guide.

**Step 5: Run the API contract test**

Run: `pnpm exec node --test scripts/docs-contracts.test.mjs`

Expected: PASS with every public package page and required Core/CLI symbol present in both languages.

**Step 6: Commit the reference update**

```bash
git add docs/api docs/ko/api docs/.vitepress/config.mts scripts/docs-contracts.test.mjs
git commit -m "docs(api): 공개 surface 레퍼런스 보강"
```

## Task 5: Restore EN/KO Guide Parity and Scenario Coverage Authoring

**Files:**
- Modify: `docs/index.md`
- Modify: `docs/ko/index.md`
- Modify: `docs/guides/writing-scenarios.md`
- Modify: `docs/ko/guides/scenario-examples.md`
- Modify: `docs/guides/multi-stage.md`
- Modify: `docs/guides/wagmi-setup.md`
- Modify: `docs/guides/ethers-setup.md`
- Modify: `docs/guides/web3js-setup.md`
- Modify: `docs/recipes/approval-flow.md`
- Modify: `docs/recipes/error-handling.md`
- Modify: `docs/recipes/swap-testing.md`
- Modify: `docs/guides/swap-demo-sepolia-uniswapv3.md`
- Create: `docs/guides/cli-workflow.md`
- Create: `docs/guides/e2e-0to1.md`
- Create: `docs/guides/playwright-routing.md`
- Create: `docs/guides/react-integration.md`
- Create: `docs/guides/scenario-examples.md`
- Create: `docs/ko/guides/writing-scenarios.md`
- Create: `docs/ko/guides/multi-stage.md`
- Create: `docs/ko/guides/wagmi-setup.md`
- Create: `docs/ko/guides/ethers-setup.md`
- Create: `docs/ko/guides/web3js-setup.md`
- Modify: `docs/.vitepress/config.mts`
- Test: `scripts/docs-contracts.test.mjs`

**Step 1: Normalize language ownership**

Translate every English-tree prose page listed above into English. Keep code, package names, command names, RPC method names, and Lua keys unchanged. Do not translate protocol identifiers or API names.

**Step 2: Add missing guide counterparts**

Create English counterparts for Korean-only CLI workflow, E2E walkthrough, Playwright routing, React integration, and scenario examples. Create Korean counterparts for English-only writing scenarios, multi-stage, wagmi, ethers, and web3.js setup. Preserve the same user-visible behavior, prerequisites, and error boundaries in each pair.

**Step 3: Add scenario coverage authoring guidance**

Add a Lua example to both scenario-authoring paths:

```lua
coverage = {
  features = { "swap" },
  states = { "quoteLoaded" },
  components = { "QuotePanel" },
}
```

Explain that all fields are optional. When omitted, feature coverage comes from `when.action`; state coverage is inferred from `then_ui`, `then_state`, and `not_present`; component coverage is inferred from the top-level `then_ui` keys. Link to the Core Coverage helpers and CLI coverage command.

**Step 4: Update both documentation indexes and sidebars**

Expose the counterpart guides from their language-specific index and sidebar groups. Do not hide a feature in one language because it has a different original path.

**Step 5: Run language and guide contract tests**

Run: `pnpm exec node --test scripts/docs-contracts.test.mjs`

Expected: PASS with all defined EN/KO guide pairs and coverage authoring snippets present.

**Step 6: Commit the parity work**

```bash
git add docs/index.md docs/ko/index.md docs/guides docs/ko/guides docs/.vitepress/config.mts scripts/docs-contracts.test.mjs
git commit -m "docs(guides): 한영 사용 가이드 정합화"
```

## Task 6: Run Full Documentation-Focused Verification

**Files:**
- Verify: `package.json`
- Verify: `scripts/docs-contracts.test.mjs`
- Verify: `scripts/docs-site.test.mjs`
- Verify: `scripts/build-docs-site.mjs`
- Verify: `docs/.vitepress/config.mts`

**Step 1: Run focused documentation contracts**

Run: `pnpm exec node --test scripts/docs-contracts.test.mjs scripts/docs-site.test.mjs`

Expected: PASS.

**Step 2: Run the repository script suite**

Run: `pnpm test:scripts`

Expected: PASS.

**Step 3: Run static quality checks**

Run: `pnpm lint:workspace-types && pnpm lint:deadcode`

Expected: PASS.

**Step 4: Build the published documentation artifact**

Run: `pnpm docs:build`

Expected: PASS. The artifact includes the VitePress site and `examples/swap-dapp` live demo, but does not contain `PRD.html` or a `plans/` directory.

**Step 5: Inspect the final change set**

Run: `git status --short && git diff --check && git diff --stat origin/main...HEAD`

Expected: only documentation, docs-build/test, navigation, and archived-record moves; no package runtime behavior or lockfile changes.

**Step 6: Commit verification-only follow-ups if necessary**

```bash
git add <verified-files>
git commit -m "test(docs): 문서 배포 경계 검증"
```

## Acceptance Criteria

- A fresh consumer following any plugin installation example receives the current `next` package, not the stale `latest` tag.
- Every package in `publicPackages` has English and Korean API references linked from VitePress navigation.
- Core and CLI reference pages name the actual exports/commands required by the documentation contract tests.
- All CI examples use the prebuild wrappers; local direct commands state their build precondition.
- Scenario authors can find and copy explicit coverage metadata without reading MCP-only documentation.
- Published VitePress output contains no historical PRD or plans pages.
- `pnpm test:scripts`, `pnpm lint:workspace-types`, `pnpm lint:deadcode`, and `pnpm docs:build` all pass.

## Follow-Up Product Work (Out of Scope)

- Implement a real scenario execution adapter for `createLunaCommands()` before considering it a stable Playwright command surface.
- Define and implement meaningful Vitest plugin behavior before promoting either plugin package from `next` to `latest`.
