# Multi-stage Flows

Use `stages` when one user flow moves through meaningful intermediate UI
states, such as approval followed by swap confirmation. Name stages after the
state a user can recognize, and keep each assertion limited to the values that
matter for that state.

```lua
scenario {
  name = "approve-then-swap",
  given = {
    allowance = { USDC = "0" },
  },
  when = { action = "swap" },
  then_ui = {
    finalScreen = "success",
  },
  stages = {
    { name = "approval_required" },
    { name = "approval_submitted" },
    { name = "quote_ready" },
    { name = "swap_confirmed" },
  },
  timing_ms = 120,
}
```

Use `timing_ms` only for an explicit timing requirement. It should not be a
substitute for waiting on an observable UI or state transition.
