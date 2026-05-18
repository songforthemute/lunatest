# Usability Audit Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 현재 코드베이스 사용성 감사에서 발견한 CI, release, CLI generation, MCP response semantics, docs drift, maintenance drift를 재발 가능성이 낮은 구조로 수정한다.

**Architecture:** 즉시 사용자 영향이 있는 workflow/CLI 보호 문제를 먼저 닫고, 그 다음 package roster 및 smoke-test 중복을 단일 source로 정리한다. 공개 API shape나 workflow 의미가 바뀌는 항목은 테스트와 문서를 같이 갱신해서 코드와 문서가 다시 갈라지지 않게 한다.

**Tech Stack:** pnpm workspace, GitHub Actions, Changesets, TypeScript, Vitest, Node test runner, knip, VitePress.

---

## Audit Summary

이번 감사는 기능 구현 자체보다 사용자가 실제로 밟는 경로의 연결성을 확인했다.

검사 범위:

- Root `package.json` scripts
- GitHub Actions `ci`, `benchmark`, `release`
- CLI `gen --ai`
- MCP `component.states`
- Smoke/e2e tests
- README/docs 상태 문구
- pack/npm smoke scripts
- `knip`/`turbo` maintenance tooling
- examples tree

이미 확인된 기본 상태:

- `pnpm test:scripts` 통과
- `pnpm lint:deadcode` 통과
- `pnpm lint:workspace-types` 통과
- `pnpm -r --filter=!@lunatest/e2e-tests lint`는 통과했지만, root script recursion 리스크를 노출했다.

---

## Findings And Fix Direction

| ID | Priority | Area | Finding | Fix Direction |
| --- | --- | --- | --- | --- |
| A1 | P1 | CI | negated workspace filter가 root package까지 선택하면서 root `build/lint/test` recursive script를 다시 실행할 수 있다. `e2e-tests` 제외 의도가 흐려지고 CI work가 중복된다. | CI 전용 workspace gate scripts에서 root package `lunatest`를 명시적으로 제외하고, workflow가 직접 filtered pnpm command를 반복하지 않게 wrapper로 모은다. |
| A2 | P1 | Release | publish가 실제 수행되어도 `steps.changesets.outputs.published == 'true'` 조건 때문에 npm registry smoke가 skip될 수 있다. | release workflow에서 publish step 성공 후 npm smoke를 deterministic하게 실행한다. 필요하면 "새 publish 여부"가 아니라 "현재 channel 소비 가능성"을 검증하는 smoke로 정의한다. |
| A3 | P1 | CLI | `gen --ai`가 adapter output batch 내부 duplicate만 막고, 이미 존재하는 scenario 파일은 덮어쓸 수 있다. | filesystem existing collision을 명시 에러로 처리하고 테스트를 추가한다. |
| A4 | P2 | Docs | EN README 상단은 `Published`인데 하단 Status는 npm publication pending이라고 되어 있다. | README status를 현재 release 상태와 일치시킨다. |
| A5 | P2 | Maintenance | public package roster, stable/next channel, pack helper, npm smoke helper가 여러 script에 중복된다. | `scripts/package-roster.mjs` 같은 단일 manifest/helper를 만들고 scripts/tests/release publish가 같은 source를 참조하게 한다. |
| A6 | P2 | E2E | e2e smoke tests가 package public entry가 아니라 `packages/*/src` internals를 직접 import한다. | source-level workspace smoke와 package-entry consumer smoke의 목적을 분리한다. 필요하면 public entry smoke를 추가하고 test name/docs를 정리한다. |
| A7 | P2 | MCP | `component.states(name)` 응답에서 component identity와 state names가 같은 배열에 섞인다. | 응답 semantics를 정리한다. component coverage는 별도 field로 분리하고 `known/covered/missing`은 state names만 담도록 테스트와 docs를 갱신한다. |
| A8 | P3 | Dead Code | `lint:deadcode`가 `knip --include files`만 사용해서 unused exports/dependencies/functions까지 보장하지 않는다. | 기존 fast gate는 유지하되, stricter dead-code audit script를 별도로 추가하거나 scheduled/manual gate로 둔다. |
| A9 | P3 | Tooling | `turbo`/`turbo.json`은 존재하지만 root scripts/CI는 `pnpm -r` 중심이라 build orchestration 도구의 역할이 불명확하다. | turbo를 CI cache 전략에 실제로 연결하거나, 사용하지 않을 의존성/설정을 제거한다. |
| A10 | P3 | Examples | `examples/defi-dashboard`는 public examples tree 안의 future placeholder다. | placeholder임을 examples index/docs에 명확히 하거나, 실사용 전까지 `docs/plans`/future area로 이동한다. |

---

## Implementation Order

권장 순서는 사용자 데이터 보호와 release confidence를 먼저 닫는 것이다.

1. A1: CI workspace recursion fix
2. A2: release npm smoke condition fix
3. A3: CLI `gen --ai` overwrite protection
4. A4/A5: README drift and package roster unification
5. A6/A7: e2e boundary and MCP semantics cleanup
6. A8/A9/A10: maintenance/tooling/example cleanup

---

## Task 1: Fix CI Workspace Recursion

**Files:**

- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/benchmark.yml`
- Modify: `scripts/ci-prebuild-workflows.test.mjs`
- Modify if needed: `docs/guides/ci-integration.md`

**Step 1: Write failing workflow script tests**

Add assertions that CI wrapper scripts do not select the root workspace package.

Expected assertions:

```js
assert.match(pkg.scripts["build:workspace:ci"], /!lunatest/);
assert.match(pkg.scripts["lint:workspace:ci"], /!lunatest/);
assert.match(pkg.scripts["test:workspace:ci"], /!lunatest/);
assert.doesNotMatch(ciWorkflow, /pnpm -r --filter=!@lunatest\/e2e-tests build/);
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm test:scripts
```

Expected: fail because `lint:workspace:ci` and `test:workspace:ci` do not exist yet, and existing CI still has direct filtered commands.

**Step 3: Add CI wrapper scripts**

Update root scripts:

```json
{
  "build:workspace:ci": "pnpm -r --filter=!lunatest --filter=!@lunatest/e2e-tests --if-present run build",
  "lint:workspace:ci": "pnpm -r --filter=!lunatest --filter=!@lunatest/e2e-tests --if-present run lint",
  "test:workspace:ci": "pnpm -r --filter=!lunatest --filter=!@lunatest/e2e-tests --if-present run test"
}
```

Keep local scripts unchanged:

```json
{
  "build": "pnpm -r --if-present run build",
  "lint": "pnpm -r --if-present run lint",
  "test": "pnpm -r --if-present run test"
}
```

**Step 4: Route workflows through wrappers**

Update `.github/workflows/ci.yml`:

```yaml
- run: pnpm run build:workspace:ci
- run: pnpm run lint:workspace:ci
- run: pnpm run test:workspace:ci
```

Update consumer-smoke prebuild:

```yaml
- run: pnpm run build:workspace:ci
```

Keep `benchmark.yml` using existing `perf:*:ci` and `test:e2e:*:ci` wrappers after confirming those wrappers call the corrected `build:workspace:ci`.

**Step 5: Verify root is not selected**

Run:

```bash
pnpm -r --filter=!lunatest --filter=!@lunatest/e2e-tests exec pwd
```

Expected:

- Output does not include repository root.
- Output does not include `e2e-tests`.
- Output includes publishable workspace packages and `examples/swap-dapp` if it remains part of workspace build.

**Step 6: Run focused validation**

Run:

```bash
pnpm test:scripts
pnpm run build:workspace:ci
pnpm run lint:workspace:ci
pnpm run test:workspace:ci
```

Expected: all pass.

---

## Task 2: Make Release NPM Smoke Deterministic

**Files:**

- Modify: `.github/workflows/release.yml`
- Modify: `scripts/ci-prebuild-workflows.test.mjs`
- Modify if needed: `docs/guides/ci-integration.md`

**Step 1: Add release workflow assertions**

Add test coverage that npm smoke is not gated only by `steps.changesets.outputs.published == 'true'`.

Expected assertion style:

```js
assert.doesNotMatch(releaseWorkflow, /if: steps\.changesets\.outputs\.published == 'true'\n\s+run: pnpm consumer-smoke:npm/);
assert.match(releaseWorkflow, /pnpm consumer-smoke:npm -- --tag=latest/);
assert.match(releaseWorkflow, /pnpm consumer-smoke:npm:next/);
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm test:scripts
```

Expected: fail because release workflow still gates registry smoke on `published`.

**Step 3: Update release workflow**

Preferred behavior:

```yaml
- run: pnpm consumer-smoke:npm -- --tag=latest
- run: pnpm consumer-smoke:npm:next
```

Reasoning:

- If publish fails, `changesets/action` fails and later steps do not run.
- If publish succeeds but Changesets output is unreliable, smoke still runs.
- If no publish happened, the smoke still validates current public channel installability, which is acceptable for release workflow confidence.

**Step 4: Run focused validation**

Run:

```bash
pnpm test:scripts
```

Expected: pass.

**Step 5: Optional manual workflow validation**

After merge, monitor the next release workflow and confirm:

- `consumer-smoke:npm -- --tag=latest` ran.
- `consumer-smoke:npm:next` ran.
- Both installed package entrypoints from npm registry.

---

## Task 3: Prevent `gen --ai` From Overwriting Existing Scenarios

**Files:**

- Modify: `packages/cli/src/commands/gen.ts`
- Modify: `packages/cli/src/__tests__/cli.test.ts`

**Step 1: Add failing test**

Add a test that creates the target file before running `gen --ai`.

Test outline:

```ts
it("fails gen when generated filename already exists on disk", async () => {
  const { cwd } = await withConfiguredProject();
  const existingPath = join(cwd, "scenarios", "generated-edge-case.lua");

  await writeFile(existingPath, "scenario { name = \"existing\" }", "utf8");

  const result = await executeCommand(["gen", "--ai"], { cwd });

  expect(result.exitCode).toBe(1);
  expect(result.output).toContain("already exists");
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @lunatest/cli test
```

Expected: fail because current implementation overwrites the file.

**Step 3: Implement atomic create**

Replace plain `writeFile(target, content, "utf8")` with an atomic create operation:

```ts
await writeFile(target, content, { encoding: "utf8", flag: "wx" });
```

Catch `EEXIST` and throw an explicit error:

```ts
throw new Error(`Generated scenario file already exists: ${target}`);
```

Keep current batch-level collision check because it gives a clearer message before filesystem writes.

**Step 4: Run focused validation**

Run:

```bash
pnpm --filter @lunatest/cli test
pnpm test:scripts
```

Expected: pass.

---

## Task 4: Fix README Status Drift

**Files:**

- Modify: `README.md`
- Check: `README.ko.md`
- Check: `docs/getting-started.md`
- Check: `docs/ko/getting-started.md`

**Step 1: Update EN README status**

Replace stale status:

```md
Active development. Runtime/CLI/MCP/docs/CI gates are integrated, with npm publication pending first stable release.
```

With current status:

```md
Active development. Runtime/CLI/MCP/docs/CI gates are integrated, and stable packages are published on npm.
```

**Step 2: Verify no stale release wording remains**

Run:

```bash
rg -n "pending first stable|publication pending|not yet published" README.md README.ko.md docs
```

Expected: no matches, except historical plan docs if intentionally kept.

**Step 3: Build docs**

Run:

```bash
pnpm docs:build
```

Expected: pass.

---

## Task 5: Centralize Public Package Roster And Script Helpers

**Files:**

- Create: `scripts/package-roster.mjs`
- Modify: `scripts/check-pack-integrity.mjs`
- Modify: `scripts/consumer-smoke-pack.mjs`
- Modify: `scripts/consumer-smoke-npm.mjs`
- Modify: `scripts/package-metadata.test.mjs`
- Modify if chosen: `scripts/publish-packages.mjs`
- Modify if chosen: `package.json`

**Step 1: Create package roster module**

Create a single source:

```js
export const repositoryUrl = "https://github.com/songforthemute/lunatest";

export const stablePackages = [
  { name: "@lunatest/contracts", dir: "packages/contracts", tag: "latest" },
  { name: "@lunatest/core", dir: "packages/core", tag: "latest" },
  { name: "@lunatest/runtime-intercept", dir: "packages/runtime-intercept", tag: "latest" },
  { name: "@lunatest/cli", dir: "packages/cli", tag: "latest" },
  { name: "@lunatest/react", dir: "packages/react", tag: "latest" },
  { name: "@lunatest/mcp", dir: "packages/mcp", tag: "latest" },
];

export const nextPackages = [
  { name: "@lunatest/vitest-plugin", dir: "packages/vitest-plugin", tag: "next" },
  { name: "@lunatest/playwright-plugin", dir: "packages/playwright-plugin", tag: "next" },
];

export const publicPackages = [...stablePackages, ...nextPackages];
```

**Step 2: Add tests first**

Update `scripts/package-metadata.test.mjs` to import `publicPackages` and `repositoryUrl`.

Expected failure before refactor: imports do not exist.

**Step 3: Refactor smoke scripts**

Use shared roster in:

- `check-pack-integrity.mjs`
- `consumer-smoke-pack.mjs`
- `consumer-smoke-npm.mjs`

Keep helper dedupe small. If duplicated `run()` and `startMcpSmoke()` remain after roster centralization, create `scripts/smoke-helpers.mjs` only if it reduces repeated code without hiding important command context.

**Step 4: Optional: centralize publish scripts**

If eliminating package roster duplication from `package.json` is in scope, create `scripts/publish-packages.mjs` and replace package scripts:

```json
{
  "release:publish:stable": "node scripts/publish-packages.mjs --channel=stable --tag=latest",
  "release:publish:next": "node scripts/publish-packages.mjs --channel=next --tag=next",
  "release:publish:dry-run": "node scripts/publish-packages.mjs --channel=stable --tag=latest --dry-run && node scripts/publish-packages.mjs --channel=next --tag=next --dry-run"
}
```

If this feels too broad for the PR, leave publish scripts duplicated and record the remaining debt explicitly in this plan's follow-up section.

**Step 5: Validate**

Run:

```bash
pnpm test:scripts
pnpm pack:check-integrity
pnpm consumer-smoke:pack
pnpm release:publish:dry-run
```

Expected: all pass.

---

## Task 6: Clarify E2E Boundary Versus Package-Entry Smoke

**Files:**

- Modify: `e2e-tests/*.test.ts`
- Modify: `docs/guides/ci-integration.md`
- Modify if needed: `README.md`
- Modify if needed: `README.ko.md`

**Step 1: Decide test naming contract**

Choose one of two directions:

1. Keep current tests as workspace-source integration tests and document that package-entry coverage is provided by `consumer-smoke:pack` and `consumer-smoke:npm`.
2. Add public-entry smoke tests that import package entrypoints after build, and keep current direct-source tests only where necessary.

Recommended direction: option 1 first, because package-entry verification already exists and is faster to stabilize.

**Step 2: Update docs**

Document the separation:

- `test:e2e:*`: workspace integration behavior.
- `consumer-smoke:pack`: packed tarball consumer behavior.
- `consumer-smoke:npm`: npm registry consumer behavior.

**Step 3: Optional package-entry smoke test**

If additional coverage is desired, add a small script that imports built package entrypoints from a temporary consumer after `pnpm pack`.

Run:

```bash
pnpm consumer-smoke:pack
```

Expected: package entrypoints resolve from tarballs.

---

## Task 7: Normalize MCP `component.states` Semantics

**Files:**

- Modify: `packages/mcp/src/tools/component.ts`
- Modify: `packages/mcp/src/__tests__/transport.test.ts`
- Modify: `docs/api/mcp.md`
- Modify: `docs/ko/api/mcp.md`

**Step 1: Write failing behavior test**

Update the test so state arrays contain state names only:

```ts
expect(result).toMatchObject({
  known: expect.arrayContaining(["idle", "pending", "success"]),
  covered: [],
  missing: expect.arrayContaining(["idle", "pending", "success"]),
  componentCoverage: {
    known: true,
    covered: true,
    missing: false,
  },
});
expect(result.known).not.toContain("SwapForm");
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @lunatest/mcp test
```

Expected: fail because current implementation includes `SwapForm` in `known`.

**Step 3: Update implementation**

Return component state coverage and component identity separately:

```ts
return {
  component: name,
  known: stateNames,
  covered: componentIsCovered ? stateNames : [],
  missing: componentIsCovered ? [] : stateNames,
  componentCoverage: {
    known: resolved.known.includes(name),
    covered: resolved.covered.includes(name),
    missing: resolved.missing.includes(name),
  },
};
```

If this is considered too breaking for the current minor release, preserve old fields and add `stateCoverage`/`componentCoverage` as additive fields first. Then schedule the cleanup as a breaking API change.

**Step 4: Update docs**

Make EN/KO API docs explicit:

- `known`, `covered`, `missing` under `component.states(name)` refer to state names.
- `componentCoverage` refers to component-level scenario coverage.

**Step 5: Validate**

Run:

```bash
pnpm --filter @lunatest/mcp test
pnpm docs:build
```

Expected: pass.

---

## Task 8: Expand Dead-Code Audit Without Slowing Fast Gates

**Files:**

- Modify: `package.json`
- Modify: `knip.json`
- Modify if needed: `.github/workflows/benchmark.yml` or a new maintenance workflow
- Modify: `docs/guides/ci-integration.md`

**Step 1: Add stricter manual script**

Keep current fast gate:

```json
{
  "lint:deadcode": "knip --config knip.json --include files"
}
```

Add a stricter audit script after confirming local output:

```json
{
  "lint:deadcode:strict": "knip --config knip.json"
}
```

**Step 2: Run strict audit locally**

Run:

```bash
pnpm lint:deadcode:strict
```

Expected:

- If it passes, add it to scheduled/manual maintenance checks.
- If it reports legitimate findings, fix them or add narrow `knip.json` ignores with comments in this plan's follow-up section.

**Step 3: Document gate distinction**

Document:

- PR gate checks unused files only for speed.
- Strict audit checks broader unused exports/dependencies and can be run before releases or on schedule.

---

## Task 9: Decide Turbo Ownership

**Files:**

- Modify: `package.json`
- Modify: `turbo.json`
- Modify: `.github/workflows/ci.yml`
- Modify if removing: `pnpm-lock.yaml`
- Modify: `docs/guides/ci-integration.md`

**Decision Required:**

Choose one:

1. Adopt turbo for workspace `build/lint/test` orchestration.
2. Remove turbo dependency/config until it is actually needed.

Recommended direction: defer adoption and remove only if no short-term CI cache plan exists. The current priority is stabilizing pnpm wrapper semantics, not changing build orchestrators.

**If adopting turbo:**

Run:

```bash
pnpm turbo run build lint test --filter=!@lunatest/e2e-tests
```

Expected: no root recursion and correct package graph ordering.

**If removing turbo:**

Run:

```bash
pnpm remove -D turbo
```

Then delete `turbo.json` if no workflow or docs reference it.

Validation:

```bash
pnpm install --frozen-lockfile
pnpm test:scripts
pnpm run build:workspace:ci
```

---

## Task 10: Clarify Future Example Placeholder

**Files:**

- Modify: `examples/defi-dashboard/README.md`
- Modify if exists: examples index docs
- Modify if needed: `README.md`
- Modify if needed: `README.ko.md`

**Step 1: Make placeholder status impossible to miss**

Update README title/body:

```md
# DeFi Dashboard Example Placeholder

This directory is intentionally non-runnable. It tracks a future example idea.
Use `examples/swap-dapp` for the current runnable example.
```

Keep KO equivalent if the file remains Korean.

**Step 2: Verify docs do not present it as runnable**

Run:

```bash
rg -n "defi-dashboard|DeFi Dashboard" README.md README.ko.md docs examples
```

Expected: every reference either says placeholder/future or points users to `examples/swap-dapp`.

---

## Full Verification

Run after completing the selected tasks:

```bash
pnpm test:scripts
pnpm lint:workspace-types
pnpm lint:deadcode
pnpm run build:workspace:ci
pnpm run lint:workspace:ci
pnpm run test:workspace:ci
pnpm pack:check-integrity
pnpm consumer-smoke:pack
pnpm docs:build
pnpm release:publish:dry-run
```

Run if network/registry access is available:

```bash
pnpm consumer-smoke:npm -- --tag=latest
pnpm consumer-smoke:npm:next
```

Run if e2e is in scope:

```bash
pnpm run test:e2e:smoke:ci
pnpm run test:e2e:extended:ci
```

---

## PR Slicing Recommendation

Preferred split:

1. `fix(ci): workspace recursive gate scope 정리`
   - Includes Task 1 and Task 2.
2. `fix(cli): 생성 시나리오 파일 충돌 방지`
   - Includes Task 3.
3. `chore(scripts): 공개 패키지 목록 단일화`
   - Includes Task 5 and README drift from Task 4.
4. `fix(mcp): component states 응답 의미 정리`
   - Includes Task 7 and docs.
5. `chore(maintenance): deadcode/turbo/examples 정리`
   - Includes Tasks 8, 9, 10.

If release pressure is high, combine Tasks 1-4 into a single blocker remediation PR and defer Tasks 5-10.

---

## Acceptance Criteria

- CI wrappers no longer select root recursive scripts by accident.
- Release workflow runs npm registry smoke after publish workflow success.
- `gen --ai` never overwrites an existing scenario file silently.
- README/docs do not contradict current npm publication state.
- Public package roster has one source of truth or remaining duplication is explicitly documented.
- E2E and consumer smoke tests have clear, documented boundaries.
- MCP `component.states` response no longer conflates component names and state names, or the compatibility tradeoff is explicitly documented.
- Dead-code and turbo decisions are intentional rather than accidental.
- Future example placeholders cannot be mistaken for runnable examples.
