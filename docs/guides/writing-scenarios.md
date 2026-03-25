# Writing Scenarios

기본 시나리오는 `given`, `when`, `then_ui` 세 축으로 작성합니다.

```ts
export const scenario = {
  name: "swap-happy-path",
  given: { wallet: { connected: true, ETH: "10" } },
  when: { action: "swap" },
  then_ui: { success: true },
};
```

필요한 경우에만 `then_state`, `stages`, `timing_ms`를 추가해 시나리오 의도를 선명하게 유지합니다.
