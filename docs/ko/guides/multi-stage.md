# Multi-stage 흐름

승인 후 스왑 확인처럼 사용자 흐름에 의미 있는 중간 UI 상태가 있을 때 `stages`를 사용합니다. 사용자가 알아볼 수 있는 상태로 이름을 짓고, 각 단계에는 필요한 값만 검증하세요.

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

`timing_ms`는 명시적인 시간 요구사항이 있을 때만 사용합니다. 관찰 가능한 UI 또는 상태 전이를 기다리는 로직을 대신해서는 안 됩니다.
