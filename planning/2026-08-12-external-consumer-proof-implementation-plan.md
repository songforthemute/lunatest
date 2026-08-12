# External Consumer Proof Implementation Plan

**Goal:** Produce E2 and E3 evidence that LunaTest reduces the cost and flakiness of testing a representative Web3 frontend flow.

**Delivery rule:** Each task below is one independently reviewable implementation and one commit. A task is not committed with failing required checks. Product gaps discovered by a task become the next task; they are not hidden inside the fixture.

## Phase 0: Strategy Contract

### Task 0 — Record the product reset

**Files:**

- `planning/2026-08-12-external-consumer-proof-design.md`
- `planning/2026-08-12-external-consumer-proof-implementation-plan.md`
- `planning/README.md`

**Acceptance:** The active initiative, evidence ladder, metrics, decision rules, and non-goals are explicit. Historical PRD framework expansion is no longer treated as the automatic next step.

**Commit:** `docs(plan): prioritize external consumer proof`

## Phase 1: Prove the Real Integration Boundary

### Task 1 — Establish a supported wagmi/viem bridge

**Intent:** Replace the unproven structural wrapper with a contract that compiles
and executes through pinned real wagmi/viem packages.

**Expected files:**

- `packages/react/src/__tests__/wagmi-real-contract.test.ts`
- `packages/react/src/adapters/wagmi.ts`
- `packages/react/package.json`
- `packages/react/CHANGELOG.md`
- `pnpm-lock.yaml`
- one changeset when public behavior changes

**Steps:**

1. Pin supported wagmi and viem versions as development-only contract dependencies.
2. Write a failing compile/runtime test through the supported wagmi transport or connector extension point.
3. Assert `eth_chainId`, accounts, balance, transaction submission, and receipt polling reach the Luna provider/runtime.
4. Implement the actual supported bridge and define migration behavior for the old
   `WagmiLikeConfig` helper.
5. Document the exact supported version range; do not claim generic wagmi support.

**Acceptance:** The test uses real imports, no `as unknown as`, no local fake config, and proves requests traverse the supported API.

**Checks:** React package test/lint/build, workspace type lint, packed consumer smoke.

**Commit:** `feat(react): add supported wagmi viem bridge`

### Task 2 — Preserve full Lua scenario semantics

**Expected files:**

- `packages/core/src/runner/execute-scenario.ts`
- focused runner contract tests
- one changeset when public behavior changes

**Steps:**

1. Add a failing contract that calls `executeLuaScenario()` with documented
   `stages`, `not_present`, and `timing_ms` assertions.
2. Prove the failure is caused by the normalization boundary, not the individual
   matcher implementations.
3. Preserve all supported scenario fields and adapter-resolved values through the
   public Lua path.
4. Verify stage order, absence checks, timing limits, and failure diagnostics at
   the runner boundary.
5. Do not reduce the representative swap journey to a single terminal assertion.

**Checks:** Focused Core runner tests, Core typecheck/lint, and existing runner/Lua compatibility suites.

**Commit:** `fix(core): preserve multi-stage scenario assertions`

### Deferred claim audit — ethers

Test the documented wrapper against a pinned real ethers version after the primary
wagmi/viem E2 proof. Decide whether the supported contract is deliberately minimal
`send()` support or true ethers provider compatibility, then narrow the docs or
implement the bridge. Do not imply compatibility that is not under contract.

## Phase 2: Build the E2 Reference Consumer

### Task 3 — Add a pinned, isolated reference application

**Expected structure:**

```text
consumer-proof/wagmi-swap/
  PROVENANCE.md
  package.json
  pnpm-lock.yaml
  src/
  scenarios/
  tests/
scripts/run-external-consumer-proof.mjs
```

Start from a pinned official React + wagmi/viem scaffold and retain origin, revision, license, and local modifications. Keep it outside the root workspace dependency graph. The runner copies it into a temporary directory and installs LunaTest packages into that clean copy.

Use a clean packed-artifact lane while Tasks 1–8 are under development. The lane
must install package tarballs rather than workspace source. Add a separate registry
lane after the corresponding package versions are published; only that lane can
satisfy E2.

**Acceptance:** The application builds before LunaTest behavior is added,
establishing a clean consumer baseline. Both install lanes reject `workspace:` and
`link:` resolution or source-tree imports. The pre-release lane requires staged
package artifacts; the registry lane rejects `file:`, tarball, and override
resolution and requires the recorded npm versions.

**Commit:** `test(consumer-proof): add isolated wagmi reference app`

### Task 4 — Implement the deterministic wallet and protocol journey

Add the minimum development/test bootstrap needed for connect → quote → approve → swap → confirmed. Use runtime-intercept and a supported integration boundary. Block all outbound RPC, wallet, quote, and protocol traffic during the scenario.

Do not copy production application logic into the test adapter. The application must make its normal provider/client calls, and LunaTest must observe or intercept those calls at the public boundary.

**Acceptance:** The real application completes the journey in Chromium without wallet extension, RPC key, faucet, testnet, or fork.

**Commit:** `feat(consumer-proof): run deterministic wagmi swap journey`

### Task 5 — Reuse one scenario in Vitest and Playwright

Add `scenarios/approve-and-swap.lua` and explicit host adapters for the two runner lifecycles. Both must load the same project-relative ID and report the same source digest. Vitest may use application state readers; Playwright must use the real rendered application.

**Acceptance:** Changing the scenario expectation changes both runner results. No duplicate scenario definition is permitted.

**Commit:** `test(consumer-proof): share swap scenario across runners`

### Task 6 — Add proof metrics and determinism gates

Produce a machine-readable report containing:

- resolved LunaTest versions and sources;
- integration files and non-test LOC delta;
- normalized scenario digest and results;
- 30-run pass/fail count;
- median and p95 warm runtime;
- attempted outbound requests;
- deliberate-failure diagnostic fields.

CI uploads the report as an artifact and enforces the E2 gates from the design. Do not commit volatile timestamps or machine-specific absolute paths.

**Commit:** `test(consumer-proof): enforce adoption evidence gates`

## Phase 3: Make the Experience Usable

### Task 7 — Close the first diagnostic gap

Deliberately break one nested expectation. If current output does not identify scenario ID, stage/path, expected, and actual values, write a failing focused test in the owning Core/runner package and improve the normalized result or assertion error.

Only the first observed diagnostic blocker is in scope for this commit.

**Commit:** `fix(reporting): make scenario mismatch actionable`

### Task 8 — Publish the measured quickstart

Write a clean-room quickstart that begins from the pinned scaffold and ends at the shared passing scenario. Include exact commands, supported versions, expected output, troubleshooting, integration footprint, and measured runtime. Validate every command against a fresh copy.

Do not promise “10 minutes” unless the E3 sessions meet the gate.

**Commit:** `docs(onboarding): add validated wagmi consumer quickstart`

### Task 9 — Certify the published E2 package set

After the required package changes are released, run the unchanged proof against
the exact npm `latest` versions. Enforce the registry-only resolution audit and
attach the machine-readable report to CI. Record the package versions that earned
E2; a passing packed-artifact lane alone is not sufficient.

**Commit:** `test(consumer-proof): certify published package evidence`

## Phase 4: Collect Direct User Evidence

### Task 10 — Prepare and run five usability sessions

Create a session script and results schema. Recruit target developers who did not implement the fixture. Give them the quickstart and two tasks: reach the first pass, then diagnose the deliberate failure. Record timings, interventions, blockers, and replacement intent.

Store anonymized aggregate results and a decision record; do not commit personal data or raw recordings.

**Commit:** `docs(research): record external adoption findings`

### Task 11 — Act on the dominant blocker

Choose exactly one branch from observed evidence:

- integration API;
- bootstrap/config discovery;
- scenario authoring;
- reporter/devtools;
- documentation.

Define its focused design and implementation separately. Do not start Vue/Svelte work as a default fallback.

**Commit:** `docs(plan): prioritize observed adoption blocker`

## Phase 5: Adoption and Expansion Gate

### Task 12 — Validate retained use with design partners

Support at least two independent repositories through adoption and two weeks of CI use. Record the testnet/mock workflow replaced and any recurring maintenance cost.

If retained use is demonstrated, write the next roadmap decision. Framework-independent extraction and Vue/Nuxt become candidates at that point; Svelte follows only after the shared boundary is proven.

**Commit:** `docs(research): record retained adoption evidence`

## Global Verification

Every implementation commit runs the narrow owning-package checks plus:

```bash
pnpm test:scripts
pnpm lint:workspace-types
pnpm lint:deadcode
git diff --check
```

Consumer-proof commits additionally run the applicable clean packed-artifact lane
and the affected Vitest/Playwright journey. Task 9 and subsequent release
certification run the registry-only lane. Public package changes require a
changeset and packed-consumer validation.

## Stop Conditions

Stop and revise the product thesis when any of these persists after one focused remediation:

- fewer than 4/5 target users reach a first pass;
- median time to first pass remains over 15 minutes;
- failures cannot be diagnosed within 5 minutes;
- the integration requires application-specific rewrites rather than a test/dev boundary;
- no design partner retains the workflow;
- the workflow does not replace a wallet, RPC, testnet, or custom-mock burden.

Passing repository CI alone is not a reason to continue. The next investment follows the strongest user evidence.
