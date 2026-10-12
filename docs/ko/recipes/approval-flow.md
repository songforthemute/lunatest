# 레시피: 승인 흐름

스왑을 진행하기 전에 승인을 별도의 사용자 가시 상태로 모델링하세요.

1. `given`에 부족한 allowance를 준비합니다.
2. 승인이 필요한 행동을 실행합니다.
3. 중요하다면 승인 UI와 allowance 상태를 검증합니다.
4. 승인에서 스왑으로의 전환 자체가 계약의 일부일 때만 `stages`를 사용합니다.

```lua
scenario {
  name = "approval-required",
  given = { allowance = { USDC = "0" } },
  when = { action = "swap" },
  then_ui = { approvalRequired = true },
  then_state = { allowance = { USDC = "0" } },
}
```
