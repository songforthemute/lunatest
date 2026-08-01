# Runner Integration Graduation Design

## Goal

Promote `@lunatest/vitest-plugin` and `@lunatest/playwright-plugin` from
next-channel helpers into real Lua scenario execution integrations without
claiming that LunaTest can infer an application's UI or emulate an EVM.

## Decision

Use an explicit execution-adapter architecture.

```text
Lua source -> Core project scenario runner -> Framework adapter -> Application
```

The Core runner owns project config loading, stable scenario IDs, Lua parsing,
execution result normalization, and explicit lookup errors. Framework packages
bind that runner to their normal test lifecycle. Application code owns the
meaning of `when.action` and the mechanism for reading observable UI/state.

## Rejected Alternatives

### Vitest custom runner and automatic Lua test collection

Vitest exposes a custom runner API, but it is advanced and experimental. Making
it the primary integration would couple a public package to test collection,
worker, reporter, and major-version internals. It also complicates asynchronous
Lua discovery and risks duplicate tests from setup-file execution.

### Selector and action inference

Mapping `when.action` to clicks and `then_ui` keys to selectors appears concise,
but it forces application-specific conventions into a general SDK. It creates
false confidence when a selector is absent, renamed, or points at an unrelated
element. LunaTest must instead fail when the host cannot provide an adapter.

### A second Playwright wallet emulator

`@lunatest/runtime-intercept` is the single owner of deterministic wallet
session, chain, event, and route behavior. Reimplementing that behavior in an
init-script fixture would duplicate state machines and drift from the runtime
contract. The existing lightweight injected provider remains deprecated; tests
requiring deterministic wallet behavior must bootstrap runtime intercept in the
application under test.

## Public Contracts

### Core

Add a Node-only project runner that exposes:

- `listLunaProjectScenarios(options)` for project-relative scenario descriptors.
- `runLunaProjectScenario(options)` for one selected source/ID and an explicit
  `ExecuteLuaScenarioAdapter`.
- `runAllLunaProjectScenarios(options)` for an ordered catalog and adapter
  factory.

Scenario IDs are project-root-relative paths without the `.lua` suffix. The
public runner accepts only exact IDs, so source selection cannot become
ambiguous. A missing ID returns a typed lookup error. A run never substitutes
`{ pass: true }` for a missing source, adapter, or resolver.

The runner uses existing project loaders and passes parsed `LuaConfig` values to
`executeLuaScenario`, avoiding a second Lua parse during `runAll`. It caches no
catalog between calls, so watch re-runs cannot execute stale Lua. One call may
reuse its in-memory descriptor list.

### Vitest

`createLunaVitestPlugin()` becomes a runner facade while preserving its current
name and `scenarioDir` option. It adds `listScenarios`, `runScenario`,
`assertScenario`, and `runAll`.

The facade is invoked inside ordinary Vitest test bodies. `assertScenario`
throws a result-aware error on a failed scenario, preserving Vitest retries,
timeouts, and reporters. `toLunaPass` remains available and reports the Luna
scenario diff when present. The package does not replace Vitest's runner or
glob-discover `.lua` files automatically.

Expose a small `createLunaVitestWatchTrigger()` helper. It returns an explicit
`watchTriggerPatterns` entry for a caller-provided Lua directory and harness
test file. This supports watch mode without mutating global test configuration
or guessing which tests consume a scenario.

### Playwright

`createLunaCommands(options)` receives project-loading options and returns real
`listScenarios`, `runScenario`, `assertScenario`, and `runAll` operations.

`createLunaPageAdapter(options)` binds an explicit Playwright-like page and host
callbacks to `ExecuteLuaScenarioAdapter`. `runWhen` lets the application reset,
apply scenario state, and perform the corresponding user action. `resolveUi`
is required; state, transition, and elapsed-time readers are optional. The
public types remain structural so the plugin does not bundle or import
`@playwright/test` at runtime.

`createLunaFixture()` remains responsible only for HTTP/RPC route installation.
Mark `injectProvider()` deprecated in types and documentation; it must not be
advertised as a wallet simulator.

## Error and Report Policy

Every framework-facing result retains `id`, `source`, `scenarioName`, `pass`,
and the Core execution result. Lookup, parsing, adapter, and assertion failures
have an actionable error message including the selected source/ID. Assertion
failures expose the existing structured assertions and textual diff.

## Cost Controls

- The plugin packages add `@lunatest/core` as a runtime dependency because Lua
  execution is the feature they provide. No browser-facing bundle imports it.
- `@playwright/test` stays a consumer-side test dependency. The repository adds
  it only to browser E2E development dependencies.
- A Linux-only browser job exercises an actual page. macOS and Windows retain
  package-consumer coverage instead of multiplying browser-binary cost.
- Exact EVM execution, implicit selector/action conventions, and a second
  wallet implementation remain out of scope.

## Release Criteria

Keep both integrations on `next` for the implementation release. Promote them
to `latest` only after packed-consumer smoke executes a real scenario and the
new Linux browser E2E is stable across post-merge runs.
