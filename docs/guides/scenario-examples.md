# Scenario Examples

These examples use the LunaTest scenario fields `given`, `when`, `then_ui`,
`then_state`, `not_present`, `stages`, and `timing_ms`.

## Success Path

```lua
scenario {
  name = "swap-happy-path",
  given = {
    wallet = { connected = true, ETH = "10" },
    pool = { pair = "ETH/USDC", reserve0 = "100", reserve1 = "180000" },
  },
  when = { action = "swap", tokenIn = "ETH", amountIn = "1" },
  then_ui = {
    success = true,
    toast = "Swap completed",
    buttonDisabled = false,
  },
}
```

## Warning and Negative UI

```lua
scenario {
  name = "high-slippage-warning",
  given = {
    wallet = { connected = true, ETH = "50" },
    market = { volatility = "high" },
  },
  when = { action = "swap", tokenIn = "ETH", amountIn = "20" },
  then_ui = {
    warning = true,
    warningLevel = "high",
    warningLabel = "> 10%",
  },
  not_present = { "insufficient-balance-error" },
}
```

## State and Stage Assertions

```lua
scenario {
  name = "approval-flow",
  given = {
    allowance = { USDC = "0" },
    wallet = { connected = true },
  },
  when = { action = "approve", token = "USDC", spender = "router" },
  then_ui = { approvalStatus = "confirmed" },
  then_state = { allowanceUpdated = true, allowanceValue = "1000000" },
  stages = {
    { name = "approval_required" },
    { name = "approval_confirmed" },
  },
}
```

Keep `name` concise enough for failure logs. Put visible values in `then_ui`,
reserve `then_state` for an internal contract, and use `not_present` for an
error or badge that must not appear.
