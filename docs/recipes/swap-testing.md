# Recipe: Swap Testing

Start with one deterministic happy path, then add independent scenarios for
approval, warnings, and failures.

```lua
scenario {
  name = "swap-happy-path",
  given = {
    wallet = { connected = true, ETH = "10" },
    pool = { pair = "ETH/USDC" },
  },
  when = { action = "swap" },
  then_ui = { success = true },
}
```

Declare the user-visible result in `then_ui`; use `then_state` only where the
application contract requires an internal state assertion.
