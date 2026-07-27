# 시나리오 작성

Lua 시나리오는 준비할 상태, 실행할 사용자 행동, 검증할 UI 또는 상태를 선언합니다. 하나의 시나리오는 한 개의 사용자 흐름에 집중하는 것이 좋습니다.

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

`then_state`, `not_present`, `stages`, `timing_ms`는 검증을 더 정확하게 표현할 때만 추가하세요. 일반적인 흐름은 [시나리오 예제](./scenario-examples.md)에서 확인할 수 있습니다.

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

명시한 차원은 해당 차원의 추론값을 대체합니다. 예를 들어 `coverage.states`만 선언하면 state는 명시값을 쓰고, `coverage.components`를 생략하면 component는 `then_ui` key에서 계속 추론합니다.
