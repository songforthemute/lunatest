# External Consumer Proof Design

**Status:** Approved for implementation

## Product Decision

LunaTest will pause framework expansion and optimize for one outcome:

> A Web3 frontend developer can add a deterministic connect → quote → approve → swap test to an existing React application, run the same scenario in Vitest and Playwright without a wallet extension, RPC key, faucet, or testnet, and diagnose a deliberate failure quickly.

This is the shortest path to proving the product thesis. More CI hardening, package surface area, Vue/Svelte adapters, and additional protocol breadth do not answer whether a team gets enough value to adopt LunaTest.

## Problem Being Proven

Web3 frontend tests depend on mutable systems outside the application:

- wallet extension state and user prompts;
- RPC availability, latency, and rate limits;
- faucet balances and testnet state;
- transaction confirmation timing;
- protocol response shapes and multi-step state transitions.

Those dependencies make important flows slow, flaky, and difficult to reproduce. Teams compensate with application-specific mocks that drift from production behavior and cannot be shared consistently between unit and browser tests.

LunaTest's proposed value is a readable scenario contract plus a deterministic in-process runtime that can be executed through the team's existing test runners.

## What Is Proven Today

The repository already proves several engineering contracts:

- public packages can be installed from packed tarballs and the npm registry;
- a generated Lua scenario can execute through the Vitest and Playwright facades;
- Chromium can execute an explicit page adapter;
- wallet, HTTP, RPC, and WebSocket behavior can be intercepted deterministically;
- the same package surface works across Linux, Windows, macOS, React 18, and React 19.

These are necessary reliability claims, but they are controlled self-tests. The packed runner fixture creates a temporary synthetic project and resolves a hard-coded `quote.status`. The browser runner test uses `page.setContent()` with one button. Neither proves adoption in a representative Web3 application or measures user effort.

Two known product-contract gaps also block the next proof: the wagmi helper has not
been exercised through real wagmi/viem APIs, and the public Lua execution path drops
documented multi-stage assertions before they reach the core runner.

## Evidence Ladder

The product will advance through four evidence levels. A higher level cannot be claimed from a lower-level test.

| Level | Evidence | Current state |
| --- | --- | --- |
| E1 | Package and runtime contracts work in repository-controlled tests | Complete |
| E2 | A representative out-of-workspace wagmi/viem consumer installs published packages and completes the full journey | Next |
| E3 | Target developers complete adoption and failure diagnosis from documentation without author guidance | Not started |
| E4 | Independent teams keep LunaTest in a real repository because it replaces meaningful mock/testnet work | Not started |

The reference consumer at E2 is deliberately called *representative*, not *external validation*. Only E3 and E4 provide direct user evidence.

## Target User and Job

### Primary persona

A React Web3 frontend developer using wagmi/viem or an injected EIP-1193 wallet. They own CI tests for transaction flows and currently depend on testnet runs, wallet automation, or hand-written provider mocks.

### Job to be done

When changing a wallet or protocol flow, the developer wants to reproduce success and failure states locally and in CI without coordinating external chain state, so that regressions are caught quickly and failures are actionable.

### First reference journey

One scenario must cover a meaningful state transition rather than isolated exports:

1. connect a deterministic wallet;
2. request a quote;
3. approve token spending;
4. submit a swap;
5. observe confirmed UI and state;
6. rerun the identical scenario through Vitest and Playwright;
7. break one expectation and use the failure output to identify the scenario, stage, field, expected value, and actual value.

## Representative Consumer Architecture

```text
Pinned official React + wagmi/viem scaffold
              |
              | npm install @lunatest/*@latest
              v
Out-of-workspace consumer directory
  ├── application code
  ├── lunatest.config.json
  ├── scenarios/approve-and-swap.lua
  ├── Vitest harness
  └── Playwright harness
              |
              v
No wallet extension, RPC key, faucet, testnet, workspace link, or local tarball
```

The fixture must retain upstream template provenance and license information. CI copies it to a clean temporary directory and installs dependencies from the registry. Its lockfile and install report must contain no `workspace:`, `link:`, local tarball, or repository override for LunaTest packages.

During implementation, a pre-release lane may install freshly packed LunaTest
artifacts into the clean temporary directory so package changes can be tested before
publication. This lane may not resolve workspace source. E2 is claimed only after
the exact passing package versions are published and the same proof passes from the
npm registry without tarballs or overrides.

### Real-library compatibility gate

The existing `withLunaWagmiConfig()` and `createEthersAdapter()` APIs are structural wrappers (`WagmiLikeConfig` and `EthersLikeProvider`). They are not yet evidence of compatibility with real wagmi, viem, or ethers runtimes.

Before building the reference journey, a contract test must compile and execute against pinned real library versions. If the current adapter cannot be passed through the real library's supported extension point, the first product implementation is to fix or replace that adapter. The proof must not bypass this gap by calling a Luna provider directly while continuing to claim wagmi support.

### Scenario-fidelity gate

The public multi-stage guide promises `stages`, `not_present`, and `timing_ms`, and
the core runner can evaluate them. The Lua execution boundary currently normalizes
only the single-stage fields, so those assertions are lost before the runner sees
them.

The representative journey must not work around this by collapsing the scenario
to a final-state assertion. Before the full swap proof starts, a contract test must
show that every documented multi-stage assertion survives `executeLuaScenario()`
and reaches the runner unchanged.

## Measurement Contract

### Automated E2 gates

All gates must pass from a clean environment using published packages.

| Measure | Gate |
| --- | --- |
| Package isolation | No LunaTest workspace, link, file, tarball, or override resolution |
| Real integration | The app uses pinned real wagmi/viem APIs, not local “like” test doubles |
| Journey coverage | connect, quote, approve, swap, and confirmation execute in Chromium |
| Scenario fidelity | Multi-stage, absence, and timing assertions execute through the public Lua path |
| Scenario reuse | Vitest and Playwright execute the same scenario ID and source digest |
| External independence | The scenario completes with outbound wallet/RPC/protocol network disabled |
| Determinism | 30 consecutive runs produce identical normalized results with zero flakes |
| Runtime budget | Warm scenario execution p95 is at most 10 seconds on the Linux CI runner |
| Failure quality | A deliberate mismatch reports scenario ID, failing stage/path, expected, and actual values |
| Integration footprint | Changed application files and non-test integration LOC are measured and reported, not hidden in generated code |

Install and browser-download time are reported separately from scenario runtime. Timing is evidence, not a cross-platform microbenchmark; regression thresholds apply only to the pinned CI environment.

### Human E3 gates

Run moderated sessions with at least five target developers who did not implement the proof fixture.

| Measure | Gate |
| --- | --- |
| First deterministic pass | At least 4/5 succeed using only the quickstart |
| Time to first pass | Median at most 15 minutes, excluding dependency download |
| Failure diagnosis | At least 4/5 identify the deliberate mismatch within 5 minutes |
| Assistance | Median no more than one facilitator intervention |
| Perceived replacement value | At least 3/5 would replace one current wallet/RPC/testnet test with this workflow |

Record blockers and observed behavior, not just satisfaction scores. Repository authors do not count as participants.

### E4 adoption gate

Before expanding to Vue/Svelte, obtain at least two independent repositories that keep a LunaTest scenario in CI for two weeks or more and identify which prior testnet or mock workflow it replaced.

## Decision Rules

The proof is designed to change priorities:

- **Real wagmi/viem contract fails:** fix the integration API first.
- **Automated journey fails without network:** fix runtime/protocol fidelity first.
- **Scenario works but setup exceeds the human gate:** improve bootstrap, config discovery, and quickstart.
- **Authors struggle to express the scenario:** improve CLI/MCP-assisted authoring or the scenario contract.
- **Failures are not diagnosable:** improve result normalization and reporters before adding features.
- **E3 passes but teams do not retain it:** interview for replacement value; do not expand frameworks.
- **E4 passes:** extract framework-independent boundaries, then evaluate Vue/Nuxt as the next distribution surface.

## Roadmap Reset

### Now: prove the core loop

1. establish real wagmi/viem compatibility;
2. preserve the documented multi-stage Lua scenario contract;
3. build the isolated reference consumer;
4. prove shared Vitest/Playwright scenario execution;
5. make deliberate failures actionable;
6. publish a measured quickstart;
7. run external usability sessions;
8. obtain retained design-partner adoption.

### Later, only after evidence

- framework-independent adapter extraction;
- Vue/Nuxt;
- Svelte/SvelteKit;
- AI-assisted edge-case generation as a measured accelerator;
- backend state-only mode, React Native, or runtime replacement research.

### Maintenance lane

Release hygiene, dependency security, documentation integrity, and stale npm dist-tag cleanup remain required maintenance. They are time-boxed and do not displace the consumer proof unless they block install, execution, or publication.

## Non-Goals

- exact EVM execution or smart-contract correctness;
- AMM math or gas-estimation correctness;
- selector or user-action inference;
- claiming Next.js, RainbowKit, ethers, Vue, or Svelte support without a real consumer contract;
- using MCP invocation success as evidence of user value;
- treating repository-owned examples as external adoption.

Foundry, Hardhat, Anvil, forked RPC, and final testnet/mainnet integration tests remain complementary tools.
