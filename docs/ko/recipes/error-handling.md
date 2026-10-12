# 레시피: 오류 처리

서로 관련 없는 오류 경로를 하나로 합치지 말고, 사용자에게 보이는 실패마다 별도의 시나리오를 작성하세요.

- 잔액 부족
- 잘못된 체인
- 거절되었거나 실패한 트랜잭션

메시지, 알림, 비활성화된 컨트롤 계약에는 `then_ui`를 사용하세요. 같은 상태에서 성공 표시가 보이면 안 될 때는 `not_present`를 추가하세요.

```lua
scenario {
  name = "swap-insufficient-balance",
  given = { wallet = { ETH = "0" } },
  when = { action = "swap" },
  then_ui = { insufficientBalance = true, actionDisabled = true },
  not_present = { "swapSuccess" },
}
```
