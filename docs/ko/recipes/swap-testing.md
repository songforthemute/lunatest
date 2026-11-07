# 레시피: 스왑 테스트

결정론적인 성공 경로 하나로 시작한 뒤, 승인, 경고, 실패에 대해 독립된 시나리오를 추가하세요.

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

사용자에게 보이는 결과는 `then_ui`에 선언하세요. 애플리케이션 계약에서 내부 상태 검증이 필요할 때만 `then_state`를 사용하세요.
