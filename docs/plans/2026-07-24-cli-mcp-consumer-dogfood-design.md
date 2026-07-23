# CLI and MCP Consumer Dogfood Design

## Status

Approved for implementation on 2026-07-24.

## Problem

The published-package smoke test currently proves that a consumer can install every LunaTest tarball, import the package entry points, run `lunatest doctor`, and keep `lunatest-mcp` alive for 800 ms. It does not prove either public executable can operate on a consumer project.

The gap is material for MCP. The shipped `lunatest-mcp` bin constructs `createMcpServer({ scenarios: [] })`, so `scenario.list`, `coverage.*`, and `scenario.run` cannot see the project's `lunatest.config.json` or Lua scenarios. The CLI already has the required behavior, but its config, source-discovery, catalog, and deterministic execution adapter are private implementation details. Copying them into MCP would create two independently drifting project loaders.

## Decision

Create a Node-only project-loading surface in `@lunatest/core`, then make CLI and the MCP bin consume it.

```
consumer project
  lunatest.config.json + *.lua
              |
              v
@lunatest/core project loader
  - resolve config root and source paths
  - parse Lua and coverage metadata
  - assign stable project-relative IDs
  - provide deterministic runtime adapter
       |                         |
       v                         v
@lunatest/cli                 @lunatest/mcp bin
existing commands             config-aware stdio server
       |                         |
       +-----------+-------------+
                   v
published-tarball consumer smoke
  CLI validate/run/coverage/gen/watch + MCP JSON-RPC
```

### Project loader contract

The root `@lunatest/core` entry point, but never `@lunatest/core/browser`, will export Node-only project utilities.

- `loadLunaProjectConfig({ cwd?, configPath?, requireConfig? })` normalizes the existing `lunatest.config.json` shape and resolves `scenarioDir` and `luaConfigPath` from the directory containing the selected config file.
- Without `configPath`, the selected path is `<cwd>/lunatest.config.json`.
- `requireConfig: false` preserves CLI's existing no-config fallback (`scenarios` and `lunatest.lua`). `requireConfig: true` produces an explicit configuration-not-found error.
- `resolveLunaScenarioSources(...)` owns the existing default Lua discovery and explicit path/glob behavior.
- `loadLunaProjectScenarios(...)` reads and parses Lua sources, resolves coverage metadata, and returns neutral records. It must not import MCP types.
- Scenario IDs are slash-normalized paths relative to the project root with the `.lua` suffix removed. For example, `lunatest.lua` is `lunatest`, and `scenarios/swap.lua` is `scenarios/swap`. Absolute local paths must never appear in the MCP descriptor ID.
- `createDeterministicScenarioAdapter()` centralizes the CLI behavior: apply route mocks, apply `given`, apply intercept state, and resolve UI/state from the resulting runtime state.

The loader moves `tinyglobby` to the core package because it becomes the dependency owner. The browser export remains dependency-safe by omitting every project loader export.

### `lunatest-mcp` launch contract

The bin becomes project-aware by default.

| Invocation | Behavior |
| --- | --- |
| `lunatest-mcp` | Require `./lunatest.config.json`, load its scenarios and catalog, then serve JSON-RPC. |
| `lunatest-mcp --config path/to/lunatest.config.json` | Resolve the project root from that file's directory and use it, regardless of the process working directory. |
| `lunatest-mcp --empty` | Start an intentionally empty generic server without config discovery. |
| `lunatest-mcp --help` | Print usage and exit successfully. |

Unknown flags, a missing `--config` value, and `--empty` combined with `--config` fail before starting stdio. A missing default config fails with an explicit path and a suggestion to use `--empty` only when a generic server is intended.

The default server passes the core scenario records to `createMcpServer`, passes `coverageCatalog`, uses the selected project root for local presets, and uses the shared deterministic adapter. Consequently, `scenario.list`, `scenario.run`, `coverage.report`, `coverage.gaps`, `coverage.suggest`, `component.states`, prompts, and preset resources operate against the same catalog a CLI user sees.

### Persistence boundary

`scenario.create` and `scenario.mutate` remain process-memory operations in this change. They will appear in subsequent requests to the same MCP process but are not written to `scenarioDir`.

This is deliberate technical debt rather than an implicit omission.

- Forgone capability: durable authoring and mutation from MCP.
- Why it is acceptable now: the existing API is already in-memory, while adding persistence requires an explicit filename policy, conflict behavior, atomic writes, and user-confirmed overwrite semantics.
- Repayment trigger: introduce persistence only in a dedicated change that defines those filesystem contracts and adds crash/overwrite integration coverage.

## Consumer verification design

The tarball consumer smoke remains the release-grade truth. It will construct a temporary project after installing packed public packages and execute:

1. `lunatest validate`
2. `lunatest run`
3. `lunatest coverage`
4. `lunatest gen --ai` against a deterministic stdin/stdout adapter
5. `lunatest watch`, including its initial run, one file-change rerun, and graceful `SIGINT` shutdown
6. `lunatest-mcp` as a real subprocess, exchanging line-delimited JSON-RPC for `scenario.list`, `scenario.run`, `coverage.report`, and `coverage.gaps`

The workflow runs once in the existing React 19 consumer matrix entry to avoid doubling the cost of an already complete React 18/19 package-resolution check. The existing matrix still installs and import-checks every public tarball for both supported peer ranges.

Every subprocess must have a bounded timeout, include captured stdout/stderr in failures, and be terminated in a `finally` path. This turns a protocol hang into a diagnosable test failure rather than an indefinitely blocked CI job.

## Documentation contract

Add an English MCP stdio guide and revise the Korean one to document the same behavior. Both guides must use installed-package commands (`pnpm exec lunatest-mcp`), include a complete project fixture, explain `--config` and `--empty`, and state the in-memory persistence boundary. API pages and the library-consumption guides link to the guide. VitePress navigation exposes it in both languages.

## Acceptance criteria

- A fresh packed consumer can use both executables without direct `dist` paths or workspace imports.
- `lunatest-mcp` exposes config-derived scenario descriptors, coverage, execution results, and project presets.
- A config passed with `--config` works from a different working directory.
- No-config startup fails clearly; `--empty` remains an intentional escape hatch.
- CLI behavior remains unchanged while its project-loading implementation no longer duplicates the core logic.
- Browser consumers do not receive Node filesystem/glob dependencies through `@lunatest/core/browser`.
