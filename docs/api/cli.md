# API: @lunatest/cli

Release channel: `latest`

`@lunatest/cli` installs the `lunatest` executable. It reads an optional `lunatest.config.json` from the working directory, or uses the built-in defaults when the configuration is absent.

## `lunatest.config.json`

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
    "args": ["./adapter.mjs"],
    "env": { "MODEL": "example" }
  }
}
```

`scenarioDir` and `luaConfigPath` are resolved from the config directory. `coverageCatalog` contributes known feature, state, and component targets. `ai` is required only by `gen --ai`.

## Commands

- `run` runs the configured Lua config and scenario directory, or an optional filter / `--scenario <fileOrGlob>` selection.
- `validate` parses the selected source set without executing it. A parse failure makes the command fail.
- `watch` performs one `run` immediately, then reruns after a 300 ms debounce when `luaConfigPath` or a `scenarioDir/**/*.lua` file changes. It stays active until `SIGINT`.
- `coverage` prints JSON with `total`, `covered`, `ratio`, `known`, `coveredTargets`, and `missing`.
- `gen` requires `--ai`. The configured external command receives a JSON object on stdin with `scenarios`, `coverage`, `presetCatalog`, and `prompts`; it must return a JSON array of generated scenarios on stdout. Generated Lua is saved in `scenarioDir`, validated, then run. Invalid JSON, invalid Lua, and duplicate target filenames are explicit failures.
- `devtools` prints the project-aware browser devtools setup guidance. Add `--open` to request the mounting guide; invoking it without that option is an error.
- `doctor` prints the resolved config path, scenario-source presence, runtime-intercept enable policy, and AI adapter configuration state.

Use the normal `lunatest` commands during local development. CI wrappers such as `pnpm run test:e2e:smoke:ci` belong to the repository's CI workflow and prebuild workspace packages before the corresponding test.
