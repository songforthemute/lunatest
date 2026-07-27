# CLI Workflow

The `lunatest` executable reads `lunatest.config.json` when it is present. The
config selects the Lua scenario sources, an optional coverage catalog, and an
optional external AI adapter.

```json
{
  "scenarioDir": "scenarios",
  "luaConfigPath": "lunatest.lua",
  "coverageCatalog": {
    "features": ["swap", "approve"],
    "states": ["quoteLoaded", "approvalPending"],
    "components": ["quotePanel", "actionButtonRow"]
  },
  "ai": {
    "command": "node",
    "args": ["./adapter.mjs"]
  }
}
```

Install the published CLI in the project that owns the scenarios, then use
`pnpm exec lunatest <command>` from that project.

## Validate and Run

```bash
pnpm exec lunatest validate
pnpm exec lunatest run
pnpm exec lunatest run swap
```

`validate` parses the selected sources. `run` executes them and exits non-zero
when its summary reports failures. Both commands accept
`--scenario <file-or-glob>` to narrow the source set.

## Watch

```bash
pnpm exec lunatest watch
```

Watch runs once at startup, then watches `luaConfigPath` and Lua files below
`scenarioDir`. Changes are debounced for 300 ms. Where recursive filesystem
watching is unavailable, the CLI falls back to polling.

## Coverage

```bash
pnpm exec lunatest coverage
```

The command prints JSON with `total`, `covered`, `ratio`, `known`,
`coveredTargets`, and `missing`. The known catalog is the union of the optional
config catalog and scenario-derived coverage metadata.

## Generate with an AI Adapter

```bash
pnpm exec lunatest gen --ai
```

`gen --ai` requires `ai.command`. LunaTest sends one JSON object to the adapter
on standard input with `scenarios`, `coverage`, `presetCatalog`, and `prompts`.
The adapter must write a JSON array on standard output. Every item requires
`name` and `lua`, and can add `coverage` and `tags`.

Generated Lua is written to `scenarioDir`. Filename collisions, invalid JSON,
invalid Lua, and failed generated scenarios are reported as command errors.

## Diagnostics and Browser Guidance

```bash
pnpm exec lunatest doctor
pnpm exec lunatest devtools --open
```

`doctor` reports resolved configuration paths, scenario source locations, the
runtime-intercept guard and current enablement, and AI adapter configuration.
`devtools --open` prints the browser entry point and mounting guidance; it does
not open a browser itself.
