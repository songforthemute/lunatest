# Recipe: Error Handling

Write a separate scenario for each user-visible failure rather than combining
unrelated error paths.

- Insufficient balance
- Wrong chain
- Rejected or failed transaction

Use `then_ui` for the message, alert, and disabled-control contract. Add
`not_present` when a success indicator must not be visible in the same state.

```lua
scenario {
  name = "swap-insufficient-balance",
  given = { wallet = { ETH = "0" } },
  when = { action = "swap" },
  then_ui = { insufficientBalance = true, actionDisabled = true },
  not_present = { "swapSuccess" },
}
```
