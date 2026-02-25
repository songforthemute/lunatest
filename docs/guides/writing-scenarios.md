# Writing Scenarios

시나리오는 `given`, `when`, `then_ui`를 기본으로 작성합니다.

```ts
export const scenario = {
  name: "swap-happy-path",
  given: { wallet: { connected: true, ETH: "10" } },
  when: { action: "swap" },
  then_ui: { success: true },
};
```

필요 시 `then_state`, `stages`, `timing_ms`를 추가합니다.
