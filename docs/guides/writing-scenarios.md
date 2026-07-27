# Writing Scenarios

A Lua scenario declares the state to arrange, the user action to exercise, and
the UI or state to assert. Keep the scenario focused on one user-visible flow.

```lua
scenario {
  name = "swap-happy-path",
  given = {
    wallet = { connected = true, ETH = "10" },
  },
  when = { action = "swap" },
  then_ui = {
    quotePanel = { visible = true },
    success = true,
  },
  then_state = {
    swap = { submitted = true },
  },
  not_present = { "insufficientBalanceError" },
}
```

Use `then_state`, `not_present`, `stages`, and `timing_ms` only when they make
the assertion more precise. See [Scenario Examples](./scenario-examples.md)
for common flow shapes.

## Coverage Metadata

`coverage` is optional scenario-level metadata for feature, state, and
component coverage reports. Declare it when the product vocabulary is more
useful than the inferred keys.

```lua
scenario {
  name = "swap-quote-ready",
  given = {
    wallet = { connected = true },
  },
  when = { action = "swap" },
  then_ui = {
    quotePanel = { visible = true },
  },
  coverage = {
    features = { "swap" },
    states = { "quoteLoaded" },
    components = { "QuotePanel" },
  },
}
```

When `coverage` is omitted, LunaTest derives it from the scenario:

- `when.action` becomes the feature target.
- Top-level keys in `then_ui`, `then_state`, and `not_present` become state targets.
- Top-level keys in `then_ui` become component targets.

Explicit metadata replaces the inferred list for the dimension it declares.
For example, `coverage.states` uses only the declared state targets, while an
omitted `coverage.components` still uses the inferred `then_ui` keys.
