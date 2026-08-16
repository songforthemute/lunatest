# Validated wagmi Swap Quickstart

This quickstart reproduces LunaTest's representative React journey: connect a
wallet, quote a Uniswap V3 swap, approve the input token, submit the swap, and
assert the same Lua scenario through Vitest and Playwright.

## Evidence status

The current result is a **packed-artifact proof**, not registry-certified E2
evidence. The runner installs freshly packed public packages in a clean
temporary consumer outside the workspace. Its report therefore has
`certificationEligible: false`.

Do not replace the packed lane with npm `latest` and call it certified. Task 9
will run this unchanged proof with registry-only resolution after the required
package releases are published.

This is also not independent user validation. The repository authors built the
reference consumer. The later E3 sessions will measure whether target
developers can follow this page without author guidance.

## Supported reference stack

The fixture is derived from the official Vite React TypeScript template at
revision `14454fd8c9a399bc3fdc193e28465b6fcf001e4d`. Its provenance and the Vite
MIT license are preserved in the fixture.

| Dependency | Validated version |
| --- | --- |
| Node.js | 24 |
| pnpm | 10.33.4 |
| React / React DOM | 19.2.8 |
| Vite | 8.2.0 |
| TypeScript | 6.0.2 |
| `@wagmi/core` | 3.6.4 |
| `viem` | 2.55.11 |
| Vitest | 4.1.6 |
| Playwright | 1.61.1 |

The public peer ranges are broader than this one measured combination:
React/React DOM `^18.3.1 || ^19.0.0`, `@wagmi/core >=3.6.4 <4`, and
`viem >=2.55.11 <3`. The full journey on this page is validated only with the
exact versions in the table.

The pack lane records the exact LunaTest package names, versions, and
`packed-tarball` sources in its report. Those manifest versions identify the
artifacts under test; they are not a claim that the matching npm versions
already contain the unreleased changes on this branch.

## From pinned scaffold to shared scenario

The replay starts by running the immutable npm package
`create-vite@9.1.2` with the `react-ts` template in a new temporary directory.
It verifies the upstream React and Vite baseline before applying the checked-in
reference overlay in this order:

1. replace the generated manifest and TypeScript/Vite configs with the exact
   pinned consumer manifest and isolated workspace policy;
2. replace the starter UI with `App.tsx`, `journey.ts`, and `swap.ts`;
3. add the Luna composition boundary in `wagmi.ts` and await it from `main.tsx`;
4. add `lunatest.config.json` and `scenarios/approve-and-swap.lua`;
5. add the Vitest adapter, Playwright adapter, shared scenario helper, and proof
   metrics helper;
6. run the packed-artifact install and every static/runtime gate against that
   generated directory rather than the repository fixture directory.

The overlay is intentionally explicit in
[`consumer-proof/wagmi-swap`](https://github.com/songforthemute/lunatest/tree/main/consumer-proof/wagmi-swap).
Use the file-role table below when transferring the same boundaries to an
existing application; do not replace its production journey with the reference
journey.

## Validate from a clean checkout

Prerequisites are Git, Node.js 24, and Corepack or pnpm 10.33.4. On Linux, the
Playwright install command also installs Chromium system dependencies.

```bash
pnpm install --frozen-lockfile
pnpm --filter @lunatest/e2e-tests exec playwright install --with-deps chromium
pnpm quickstart:wagmi:validate -- --enforce-ci-budget
```

These are the same install, browser, and quickstart commands enforced by the
Linux CI job. The validator and proof runner then perform the clean-room work:

1. creates the pinned official Vite scaffold and applies the ordered overlay;
2. builds and packs every public LunaTest package;
3. copies the generated app again to the proof directory outside the repository
   workspace;
4. installs only the staged tarballs for LunaTest and audits the lockfile,
   overrides, versions, and installed real paths;
5. runs typecheck, lint, and a production Vite build;
6. runs one excluded warm-up and 30 measured Vitest journeys;
7. runs one excluded warm-up and 30 measured Chromium journeys in fresh browser
   contexts;
8. writes `artifacts/external-consumer-proof/pack.json` and fails if any gate is
   red.

The successful tail is:

```text
[external-consumer-proof] report=.../artifacts/external-consumer-proof/pack.json
[external-consumer-proof] OK lane=pack packages=8
```

Open the JSON report and confirm:

- `passed` is `true` and `certificationEligible` is `false`;
- both runners report `iterations: 30`, `passed: 30`, and `failed: 0`;
- both runners contain the same single fingerprint;
- `network.attemptedCount` is `0`;
- every gate is green, including `failureQuality` and the enforced 10-second
  Playwright p95 budget.

## What the application adds

The reference application keeps LunaTest at the composition and test
boundaries. Its ordinary journey code uses real `@wagmi/core` and viem actions.

| File | Role |
| --- | --- |
| `src/wagmi.ts` | Bootstrap the deterministic runtime, then give the same synthetic EIP-1193 provider to the Luna wagmi connector and transport. |
| `src/main.tsx` | Await the composition root before rendering React. |
| `src/swap.ts` | Call normal wagmi/viem read, write, and receipt actions. It contains no LunaTest imports. |
| `src/journey.ts` | Own the production connect → quote → approve → swap state machine. |
| `src/App.tsx` | Render user controls and observable state. |
| `scenarios/approve-and-swap.lua` | Declare the shared UI, state, transition, absence, and coverage contract. |
| `tests/journey.test.ts` | Bind the shared scenario to the real application controller in Vitest. |
| `tests/journey.spec.ts` | Bind the same scenario ID to rendered DOM controls in Playwright. |

The exact reference files live under
[`consumer-proof/wagmi-swap`](https://github.com/songforthemute/lunatest/tree/main/consumer-proof/wagmi-swap).
When adapting an existing app, keep its production journey intact and confine
LunaTest imports to the equivalent of `src/wagmi.ts`, `src/main.tsx`, and the
test adapters.

The shared scenario observes this path:

```text
disconnected → wallet_connected → quote_ready → approval_required
→ approval_pending → ready_to_swap → swap_pending → swap_confirmed
```

It expects a quote of `1800`, allowance `1`, input balance `24`, and output
balance `1800`. The app does not patch quote, allowance, or balances manually;
the built-in Uniswap V3 preset handles the protocol requests through the
synthetic provider.

## Measured result

The Task 8 clean-copy validation run recorded on 2026-08-16 produced:

| Runner | Measured passes | Median | p95 |
| --- | ---: | ---: | ---: |
| Vitest | 30/30 | 3.338 ms | 5.654 ms |
| Playwright | 30/30 | 110.947 ms | 120.793 ms |

Both runners produced fingerprint
`sha256:143b046c151669494867a2ad534f96abc69e4310be10fca884c291db76bd6a93`
and attempted zero outbound HTTP or WebSocket requests, including the excluded
warm-up.

Setup is reported separately: package build/pack, clean install, static checks,
and runner command time are not included in scenario runtime. Browser download
and scaffold acquisition time were not measured in this run.

The integration footprint from the pinned scaffold baseline to the shared
journey is five changed application files and 384 net non-test application LOC.
Only two files are LunaTest integration boundaries, totaling 65 net non-test
LOC. These are reference-fixture measurements, not a promise for every app.

No “10-minute setup” claim is made. Time to first pass belongs to the E3 user
study and excludes dependency download only after that protocol is run.

## Deliberate failure

The proof changes the observed output balance from `1800` to `1799` and requires
the diagnostic to identify all four fields:

```text
scenarioId: scenarios/approve-and-swap
path: then_ui.output_balance
expected: 1800
actual: 1799
```

This check prevents a green report when the runner falls back to an unactionable
whole-object diff.

## Troubleshooting

### Chromium is missing

Run the Playwright install command again. On Linux CI, keep `--with-deps`; on a
machine where system packages are already installed, `playwright install
chromium` is sufficient.

### Package isolation fails

Remove workspace links, local `file:` dependencies, and LunaTest overrides from
the consumer. The pack lane permits only the generated tarballs staged for that
run. A registry fallback is also a failure in this lane.

### Outbound access is reported

The browser permits only the exact local Vite preview origin. RPC, protocol HTTP,
wallet extension, and WebSocket access are blocked and counted. In Node, local
Wasm file loading is allowed, but HTTP(S) and WebSocket attempts are not.

### The footprint is stale

If an application source file changes, regenerate and review the footprint
instead of editing its digest by hand. The runner hashes the declared source
files and rejects stale metadata.

### Runtime p95 fails

The 10-second gate uses the unrounded nearest-rank p95 from 30 measured browser
runs. Install, browser startup, page boot, and the excluded warm-up are not part
of this metric. Inspect the report's runner samples before changing the budget.

### A scenario assertion fails

Start with the scenario ID and structured mismatch path. If the two runners
report different source digests, verify that both load
`scenarios/approve-and-swap.lua` through the project-relative scenario ID rather
than embedding a copy.
