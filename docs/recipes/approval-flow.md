# Recipe: Approval Flow

Model approval as a distinct user-visible state before the swap can proceed.

1. Arrange an insufficient allowance in `given`.
2. Trigger the action that requires approval.
3. Assert the approval UI and the allowance state when they matter.
4. Use `stages` only when the approval-to-swap transition itself is part of the contract.

```lua
scenario {
  name = "approval-required",
  given = { allowance = { USDC = "0" } },
  when = { action = "swap" },
  then_ui = { approvalRequired = true },
  then_state = { allowance = { USDC = "0" } },
}
```
