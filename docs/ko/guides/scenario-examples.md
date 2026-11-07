# 시나리오 예제

LunaTest 시나리오는 준비할 상태(`given`), 실행할 행동(`when`), 검증할 UI 또는 상태를 선언합니다. 하나의 시나리오는 가능한 한 하나의 사용자 흐름에 집중하세요.

## 기본 성공 흐름

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

`then_state`, `not_present`, `stages`, `timing_ms`는 검증 의도를 더 명확하게 할 때만 추가합니다.

## 경고와 부정 UI

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

경고처럼 사용자에게 보이는 값은 `then_ui`에 두고, 같은 흐름에서
보이면 안 되는 오류나 배지는 `not_present`로 검증합니다.

## 상태와 단계 검증

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

`then_state`는 내부 계약을 위한 값에 사용하고, `stages`에는 사용자 흐름에서
의미 있는 중간 상태만 선언합니다.

## Coverage metadata

`coverage`는 feature, state, component coverage 보고서에 쓰는 선택 메타데이터입니다. 추론된 key보다 제품 용어가 더 적절할 때 명시합니다.

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

`coverage`를 생략하면 LunaTest가 시나리오 shape에서 값을 추론합니다.

- `when.action`은 feature target이 됩니다.
- `then_ui`, `then_state`, `not_present`의 top-level key는 state target이 됩니다.
- `then_ui`의 top-level key는 component target이 됩니다.

명시한 차원은 해당 차원의 추론값을 대체합니다. 예를 들어 `coverage.states`만 선언하면 state는 명시값을 쓰고, `coverage.components`를 생략한 경우 component는 `then_ui` key에서 계속 추론합니다.
