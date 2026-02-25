# 시나리오 예제 모음

아래 예제는 LunaTest 시나리오 스키마(`given`, `when`, `then_ui`, `then_state`, `stages`, `not_present`, `timing_ms`)를 기준으로 작성했습니다.

## 1) 기본 성공 케이스

```ts
export const swapHappyPath = {
  name: "swap-happy-path",
  given: {
    wallet: { connected: true, ETH: "10" },
    pool: { pair: "ETH/USDC", reserve0: "100", reserve1: "180000" },
  },
  when: { action: "swap", tokenIn: "ETH", amountIn: "1" },
  then_ui: {
    success: true,
    toast: "Swap completed",
    buttonDisabled: false,
  },
};
```

## 2) 경고 UI 케이스 (슬리피지)

```ts
export const highSlippageWarning = {
  name: "high-slippage-warning",
  given: {
    wallet: { connected: true, ETH: "50" },
    market: { volatility: "high" },
  },
  when: { action: "swap", tokenIn: "ETH", amountIn: "20" },
  then_ui: {
    warning: true,
    warningLevel: "high",
    warningLabel: "> 10%",
  },
  not_present: ["insufficient-balance-error"],
};
```

## 3) 상태 검증 포함 케이스

```ts
export const approvalFlow = {
  name: "approval-flow",
  given: {
    allowance: { USDC: "0" },
    wallet: { connected: true },
  },
  when: { action: "approve", token: "USDC", spender: "router" },
  then_ui: {
    approvalStatus: "confirmed",
  },
  then_state: {
    allowanceUpdated: true,
    allowanceValue: "1000000",
  },
};
```

## 4) 멀티 스테이지 케이스

```ts
export const stagedQuoteToSwap = {
  name: "staged-quote-to-swap",
  given: {
    wallet: { connected: true },
  },
  when: { action: "swap-flow" },
  then_ui: {
    finalScreen: "success",
  },
  stages: [
    { name: "quote_loading" },
    { name: "quote_ready" },
    { name: "swap_submitted" },
    { name: "swap_confirmed" },
  ],
};
```

## 5) 타이밍 제약 케이스

```ts
export const responseTimeGate = {
  name: "response-time-gate",
  given: {
    backend: { profile: "slow" },
  },
  when: { action: "load_quote" },
  then_ui: {
    quoteVisible: true,
  },
  timing_ms: 120,
};
```

## 실무 팁

- `name`은 테스트 실패 로그에서 바로 검색 가능한 값으로 짧게 유지합니다.
- `then_ui`는 화면에서 확인 가능한 값(텍스트, 상태, 플래그)만 넣습니다.
- `then_state`는 내부 상태 검증이 꼭 필요한 경우에만 추가합니다.
- `not_present`에는 "보이면 안 되는 에러/배지"를 넣어 회귀를 빠르게 잡습니다.
