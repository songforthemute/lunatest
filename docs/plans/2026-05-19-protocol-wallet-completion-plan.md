# Protocol Preset And Wallet Interceptor Completion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Built-in protocol presets and the Luna wallet interceptor become a complete v1.1 deterministic test-double surface for React Web3 app testing.

**Architecture:** Keep the implementation inside the existing preset/materialization/runtime-intercept path instead of adding a separate EVM simulator. Protocol presets seed a normalized protocol runtime state and route surface; runtime-intercept resolves common wallet, ERC-20, and protocol JSON-RPC calls against that state for `window.ethereum`, `fetch`, and XHR. This PR targets deterministic frontend support level L3, not exact EVM execution.

**Tech Stack:** TypeScript, Lua preset manifests, Vitest, pnpm workspace, VitePress docs, React devtools, EIP-1193-style provider interception.

---

## Scope

One PR should close the gap between "built-in preset metadata exists" and "a React dApp can exercise supported protocol flows without hand-written route mocks."

Included:

- Support matrix and acceptance contract for built-in protocols.
- Wallet interceptor method coverage for common React dApp flows.
- Deterministic ERC-20 state and transaction effects.
- Deterministic protocol runtime handlers for:
  - Uniswap V2
  - Uniswap V3
  - Curve
  - Aave
- Built-in preset materialization that seeds protocol runtime state.
- Runtime integration for `window.ethereum`, fetch JSON-RPC, and XHR JSON-RPC.
- React bootstrap/devtools propagation of protocol runtime state.
- Tests and docs proving the supported matrix.

Out of scope:

- Exact EVM execution.
- Exact Uniswap/Curve/Aave contract math parity.
- Real cryptographic signing.
- Multi-chain RPC archive behavior.
- Full MetaMask UI compatibility.

Conscious debt:

- We choose deterministic approximations over exact protocol math. This keeps the PR shippable and consistent with LunaTest's "frontend deterministic test double" position. Revisit exact math only if user-facing tests need on-chain parity rather than UI state coverage.
- Mock signatures are deterministic fake signatures. This is enough for dApps that only need a signature-shaped value; it is not enough for tests that verify signatures cryptographically.
- Native balance strings will be treated as wei-like integer strings in runtime-intercept. Existing examples that use `"1"` keep working as tiny balances, but docs must state the unit clearly.

## Support Levels

| Level | Meaning | Target |
| --- | --- | --- |
| L0 | Catalog metadata only | Already available |
| L1 | Materializes wallet/state/routes | Already partial |
| L2 | Read-only ABI/RPC calls resolve deterministically | This PR |
| L3 | Write calls mutate deterministic state and receipts | This PR |
| L4 | Exact EVM/protocol execution | Out of scope |

Acceptance target for all built-in protocols: **L3 deterministic frontend support**.

## Current Code Findings

- `packages/core/src/presets/registry.ts` already supports `walletSession`, `interceptState`, `routeMocks`, and `builtinScenarios`.
- Built-in protocol presets currently return mostly metadata and empty `routeMocks`.
- `packages/runtime-intercept/src/interceptors/ethereum.ts` already handles core wallet methods and generic transaction hashes/receipts.
- fetch/XHR interceptors can mock JSON-RPC, but they do not share wallet/protocol runtime state yet.
- React bootstrap applies materialized protocol `routeMocks`, `interceptState`, and `walletSession`, so the integration seam already exists.
- `examples/swap-dapp` still uses project-local preset state plus app-level Luna wallet helpers; built-in protocol support should reduce this manual glue.

## Proposed Runtime State Shape

Use `interceptState.protocolRuntime` as an internal state payload. Do not expose a new public top-level runtime API unless implementation proves it necessary.

```ts
type ProtocolRuntimeState = {
  activeProtocol: "uniswap_v2" | "uniswap_v3" | "curve" | "aave";
  chainId: number;
  tokens: Record<string, {
    symbol: string;
    decimals: number;
    balances: Record<string, string>;
    allowances: Record<string, Record<string, string>>;
  }>;
  transactionBehavior?: {
    confirmationDelayMs?: number;
    forcePending?: boolean;
    forceRevert?: boolean;
    userRejectedMethods?: string[];
  };
  uniswapV2?: {
    router: string;
    factory?: string;
    pairs: Array<{
      token0: string;
      token1: string;
      reserve0: string;
      reserve1: string;
    }>;
  };
  uniswapV3?: {
    router: string;
    quoter: "v1" | "v2";
    pools: Array<{
      token0: string;
      token1: string;
      fee: number;
      priceNumerator: string;
      priceDenominator: string;
      liquidity?: string;
    }>;
  };
  curve?: {
    router: string;
    pools: Array<{
      name: string;
      coins: string[];
      balances: string[];
      feeBps: number;
    }>;
  };
  aave?: {
    pool: string;
    oracle: string;
    reserves: Array<{
      asset: string;
      symbol: string;
      price: string;
      ltvBps: number;
      liquidationThresholdBps: number;
    }>;
    positions: Record<string, {
      collateral: Record<string, string>;
      debt: Record<string, string>;
    }>;
  };
};
```

## Task 1: Support Matrix And Terminology

**Files:**

- Create: `docs/guides/protocol-support.md`
- Create: `docs/ko/guides/protocol-support.md`
- Modify: `docs/api/core.md`
- Modify: `docs/ko/api/core.md`
- Modify: `README.md`
- Modify: `README.ko.md`

**Step 1: Document support levels**

Add the L0-L4 table above and state that built-in protocol support targets L3 deterministic frontend support.

**Step 2: Document method matrix**

Add one table per protocol:

- Uniswap V2: `getPair`, `getReserves`, `getAmountsOut`, `getAmountsIn`, `swapExactTokensForTokens`
- Uniswap V3: `quoteExactInputSingle`, `quoteExactOutputSingle`, `slot0`, `liquidity`, `exactInputSingle`
- Curve: `coins`, `balances`, `get_dy`, `exchange`, `get_virtual_price`
- Aave: `getUserAccountData`, `getReserveData`, `getAssetPrice`, `supply`, `withdraw`, `borrow`, `repay`

**Step 3: Document wallet matrix**

Document supported wallet methods:

- `eth_chainId`
- `eth_accounts`
- `eth_requestAccounts`
- `wallet_requestPermissions`
- `wallet_getPermissions`
- `wallet_revokePermissions`
- `wallet_switchEthereumChain`
- `wallet_addEthereumChain`
- `wallet_watchAsset`
- `personal_sign`
- `eth_signTypedData_v4`
- `eth_getBalance`
- `eth_blockNumber`
- `eth_getBlockByNumber`
- `eth_getTransactionCount`
- `eth_gasPrice`
- `eth_feeHistory`
- `eth_maxPriorityFeePerGas`
- `eth_estimateGas`
- `eth_sendTransaction`
- `eth_getTransactionReceipt`
- `eth_call`
- `eth_getLogs`
- `net_version`

**Step 4: Verify docs build**

Run:

```bash
pnpm docs:build
```

Expected: PASS.

## Task 2: Runtime Provider Error Model

**Files:**

- Create: `packages/runtime-intercept/src/provider-errors.ts`
- Modify: `packages/runtime-intercept/src/interceptors/ethereum.ts`
- Test: `packages/runtime-intercept/src/__tests__/ethereum.test.ts`

**Step 1: Add failing tests**

Add tests for:

- `wallet_addEthereumChain` validates `chainId`.
- `wallet_switchEthereumChain` throws code `4902` for an unknown chain unless it was added.
- configured user rejection throws code `4001`.
- unsupported wallet method throws code `4200` in wallet-enabled strict mode.

**Step 2: Implement provider errors**

Add:

```ts
export type LunaProviderErrorCode = 4001 | 4100 | 4200 | 4900 | 4901 | 4902;

export function createProviderError(code: LunaProviderErrorCode, message: string): Error & { code: LunaProviderErrorCode } {
  const error = new Error(message) as Error & { code: LunaProviderErrorCode };
  error.code = code;
  return error;
}
```

**Step 3: Wire errors into ethereum interceptor**

Use provider errors for wallet user rejection, unsupported wallet methods, missing permissions, and unknown chain.

**Step 4: Verify**

Run:

```bash
pnpm --filter @lunatest/runtime-intercept test -- ethereum.test.ts
```

Expected: PASS.

## Task 3: Wallet Method Completion

**Files:**

- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/runtime-intercept/src/runtime.ts`
- Modify: `packages/runtime-intercept/src/types.ts`
- Modify: `packages/runtime-intercept/src/interceptors/ethereum.ts`
- Test: `packages/contracts/src/__tests__/contracts.test.ts`
- Test: `packages/runtime-intercept/src/__tests__/wallet-session.test.ts`
- Test: `packages/runtime-intercept/src/__tests__/ethereum.test.ts`

**Step 1: Extend wallet state**

Add optional wallet runtime metadata without breaking existing sessions:

```ts
type LunaWalletKnownChain = {
  chainId: string;
  chainName?: string;
  rpcUrls?: string[];
  nativeCurrency?: {
    name: string;
    symbol: string;
    decimals: number;
  };
};

type LunaWalletSession = {
  enabled: boolean;
  connected: boolean;
  chainId: string;
  accounts: string[];
  permissions: LunaWalletPermission[];
  assets: LunaWalletAssetState;
  knownChains?: Record<string, LunaWalletKnownChain>;
  watchedAssets?: Record<string, LunaWalletTokenAsset>;
};
```

Keep optional fields optional for backward compatibility.

**Step 2: Add tests for normalization**

Verify `createLunaWalletSession()` preserves `knownChains` and normalizes `watchedAssets` addresses.

**Step 3: Implement methods**

Add wallet handling for:

- `wallet_addEthereumChain`
- `wallet_watchAsset`
- `personal_sign`
- `eth_signTypedData_v4`
- `eth_getBalance`
- `eth_getBlockByNumber`
- `eth_feeHistory`
- `eth_maxPriorityFeePerGas`
- `net_version`

**Step 4: Add deterministic signature helper**

Return a 65-byte hex string derived from method + params + active account. Do not claim cryptographic validity.

**Step 5: Verify**

Run:

```bash
pnpm --filter @lunatest/contracts test
pnpm --filter @lunatest/runtime-intercept test -- ethereum.test.ts wallet-session.test.ts
```

Expected: PASS.

## Task 4: Shared Protocol Runtime Resolver

**Files:**

- Create: `packages/runtime-intercept/src/protocols/hex.ts`
- Create: `packages/runtime-intercept/src/protocols/state.ts`
- Create: `packages/runtime-intercept/src/protocols/erc20.ts`
- Create: `packages/runtime-intercept/src/protocols/engine.ts`
- Modify: `packages/runtime-intercept/src/runtime.ts`
- Modify: `packages/runtime-intercept/src/interceptors/ethereum.ts`
- Modify: `packages/runtime-intercept/src/interceptors/fetch.ts`
- Modify: `packages/runtime-intercept/src/interceptors/xhr.ts`
- Test: `packages/runtime-intercept/src/__tests__/protocol-engine.test.ts`
- Test: `packages/runtime-intercept/src/__tests__/network-routing.test.ts`

**Step 1: Add hex helpers**

Implement minimal helpers:

- `stripHexPrefix(value)`
- `pad32(value)`
- `hexQuantity(value)`
- `uint256Hex(value)`
- `addressFromWord(word)`
- `wordFromAddress(address)`
- `encodeBool(value)`
- `encodeString(value)`
- `encodeUintArray(values)`

No external dependency.

**Step 2: Add selector matching**

Support at least:

- ERC-20 `symbol()`
- ERC-20 `decimals()`
- ERC-20 `balanceOf(address)`
- ERC-20 `allowance(address,address)`
- ERC-20 `approve(address,uint256)`
- Uniswap V2 router/pair selectors listed in Task 1
- Uniswap V3 quoter/router/pool selectors listed in Task 1
- Curve selectors listed in Task 1
- Aave selectors listed in Task 1

**Step 3: Add resolver contract**

```ts
type ProtocolResolution =
  | { handled: true; result: unknown }
  | { handled: false };

export function resolveProtocolRequest(input: {
  method: string;
  params: unknown;
  runtimeState: Record<string, unknown>;
  walletSession: LunaWalletSession;
  setWalletSession: (session: Partial<LunaWalletSession>) => LunaWalletSession;
  now?: () => number;
}): ProtocolResolution;
```

**Step 4: Hook ethereum interceptor**

Call `resolveProtocolRequest()` before generic transaction fallback for:

- `eth_call`
- `eth_sendTransaction`
- `eth_getTransactionReceipt`
- `eth_getLogs`

**Step 5: Hook fetch/XHR RPC interceptors**

Refactor `installFetchInterceptor()` and `installXhrInterceptor()` to receive a runtime-state controller. When a matched RPC route has no explicit mock response, ask the protocol resolver before strict blocking.

**Step 6: Verify**

Run:

```bash
pnpm --filter @lunatest/runtime-intercept test -- protocol-engine.test.ts network-routing.test.ts ethereum.test.ts
```

Expected: PASS.

## Task 5: ERC-20 State Effects

**Files:**

- Modify: `packages/runtime-intercept/src/protocols/erc20.ts`
- Modify: `packages/runtime-intercept/src/protocols/engine.ts`
- Test: `packages/runtime-intercept/src/__tests__/protocol-engine.test.ts`

**Step 1: Add failing tests**

Test:

- `balanceOf(owner)` reads `walletSession.assets.tokens[token].balance`.
- `allowance(owner, spender)` reads token allowance.
- `approve(spender, amount)` mutates token allowance.
- transfer-like effects can debit/credit balances where protocol handlers use them.

**Step 2: Implement read effects**

Resolve read calls from wallet assets.

**Step 3: Implement write effects**

On `approve`, call `setWalletSession({ assets: nextAssets })`.

**Step 4: Verify**

Run:

```bash
pnpm --filter @lunatest/runtime-intercept test -- protocol-engine.test.ts
```

Expected: PASS.

## Task 6: Built-In Protocol Runtime State Builders

**Files:**

- Create: `packages/core/src/presets/protocol-support.ts`
- Modify: `packages/core/src/presets/protocol/uniswap_v2.lua`
- Modify: `packages/core/src/presets/protocol/uniswap_v3.lua`
- Modify: `packages/core/src/presets/protocol/curve.lua`
- Modify: `packages/core/src/presets/protocol/aave.lua`
- Test: `packages/core/src/presets/__tests__/registry.test.ts`

**Step 1: Add tests for materialized support**

For every built-in protocol, assert:

- `interceptState.protocolRuntime.activeProtocol` is set.
- `routeMocks` includes `eth_call`, `eth_sendTransaction`, `eth_getTransactionReceipt`, and `eth_getLogs` for the ethereum endpoint.
- `walletSession.assets.tokens` contains relevant token seeds where the protocol needs them.
- `builtinScenarios` cover read, approval/write, and edge/error flows.

**Step 2: Seed route mocks from Lua**

Each protocol materialization should return:

```lua
routeMocks = {
  { endpointType = "ethereum", method = "eth_call", responseKey = "protocol.runtime" },
  { endpointType = "ethereum", method = "eth_sendTransaction", responseKey = "protocol.runtime" },
  { endpointType = "ethereum", method = "eth_getTransactionReceipt", responseKey = "protocol.runtime" },
  { endpointType = "ethereum", method = "eth_getLogs", responseKey = "protocol.runtime" },
}
```

The runtime resolver treats `protocol.runtime` as a signal to resolve from `protocolRuntime` when no explicit response exists.

**Step 3: Seed protocol runtime state**

Each Lua preset should return:

```lua
interceptState = {
  protocolRuntime = {
    activeProtocol = "...",
    chainId = chainId,
    tokens = { ... },
    ...
  },
}
```

**Step 4: Expand built-in scenarios**

Minimum scenario ids:

- `quote_success`
- `approval_required`
- `approve_success`
- `transaction_pending`
- `transaction_reverted`
- protocol-specific risk scenario:
  - Uniswap V2/V3: `high_slippage`
  - Curve: `imbalanced_pool`
  - Aave: `health_factor_warning`

**Step 5: Verify**

Run:

```bash
pnpm --filter @lunatest/core test -- registry.test.ts
```

Expected: PASS.

## Task 7: Protocol Handlers

**Files:**

- Create: `packages/runtime-intercept/src/protocols/uniswap-v2.ts`
- Create: `packages/runtime-intercept/src/protocols/uniswap-v3.ts`
- Create: `packages/runtime-intercept/src/protocols/curve.ts`
- Create: `packages/runtime-intercept/src/protocols/aave.ts`
- Modify: `packages/runtime-intercept/src/protocols/engine.ts`
- Test: `packages/runtime-intercept/src/__tests__/protocol-engine.test.ts`

**Step 1: Uniswap V3 first**

Implement:

- `quoteExactInputSingle`
- `quoteExactOutputSingle`
- `slot0`
- `liquidity`
- `exactInputSingle`

Effects:

- quotes use deterministic ratio from pool state.
- swap debits tokenIn and credits tokenOut.
- allowance is checked before swap.
- `forcePending` and `forceRevert` affect receipt behavior.

**Step 2: Uniswap V2**

Implement:

- `getPair`
- `getReserves`
- `getAmountsOut`
- `getAmountsIn`
- `swapExactTokensForTokens`

Effects:

- constant-product approximation from seeded reserves.
- deterministic reserve updates after swap.

**Step 3: Curve**

Implement:

- `coins`
- `balances`
- `get_dy`
- `exchange`
- `get_virtual_price`

Effects:

- simplified stable swap quote from pool balances.
- exchange updates balances.

**Step 4: Aave**

Implement:

- `getReserveData`
- `getAssetPrice`
- `getUserAccountData`
- `supply`
- `withdraw`
- `borrow`
- `repay`

Effects:

- positions update collateral/debt.
- health factor updates after borrow/repay/price shock.
- unsafe borrow/withdraw returns revert receipt.

**Step 5: Verify**

Run:

```bash
pnpm --filter @lunatest/runtime-intercept test -- protocol-engine.test.ts
```

Expected: PASS.

## Task 8: React Bootstrap And Devtools Surface

**Files:**

- Modify: `packages/react/src/bootstrap.ts`
- Modify: `packages/react/src/devtools/LunaDevtoolsPanel.tsx`
- Test: `packages/react/src/__tests__/bootstrap.test.ts`
- Test: `packages/react/src/__tests__/devtools-panel.test.tsx`

**Step 1: Bootstrap ordering test**

Add a test that materialized protocol state applies:

1. initial config routes/state
2. protocol route/state/wallet
3. explicit wallet preset override if provided
4. direct wallet preset override if provided

**Step 2: Ensure protocol runtime state is not dropped**

Assert `applyInterceptState(materialized.interceptState)` receives `protocolRuntime`.

**Step 3: Devtools preview**

Add a compact preview section:

- active protocol
- chain id
- token count
- route count
- supported method count

Do not build a full protocol editor in this PR.

**Step 4: Verify**

Run:

```bash
pnpm --filter @lunatest/react test
```

Expected: PASS.

## Task 9: Example And E2E Coverage

**Files:**

- Modify: `examples/swap-dapp/lunatest/presets/protocol/team_swap.lua`
- Modify: `examples/swap-dapp/src/lib/wallet.ts`
- Modify if needed: `examples/swap-dapp/src/app.tsx`
- Create: `e2e-tests/protocol-wallet-completion.smoke.test.ts`
- Modify: `e2e-tests/package.json`

**Step 1: Add smoke test**

The smoke test should:

- materialize `builtin/uniswap_v3`.
- enable runtime intercept.
- connect Luna wallet.
- call `eth_chainId`.
- call ERC-20 `balanceOf`.
- call ERC-20 `approve`.
- call Uniswap V3 quote.
- submit a swap transaction.
- poll receipt.

**Step 2: Add protocol matrix smoke**

Loop through all built-ins and verify:

- materialization succeeds.
- support routes are present.
- wallet session is valid.
- one read call resolves.

**Step 3: Wire into e2e smoke**

Update `e2e-tests/package.json`:

```json
"test:smoke": "vitest run mcp-flow.smoke.test.ts playwright-routing.smoke.test.ts cli-gen.smoke.test.ts protocol-wallet-completion.smoke.test.ts"
```

**Step 4: Verify**

Run:

```bash
pnpm run test:e2e:smoke:ci
```

Expected: PASS.

## Task 10: API Docs And KO Parity

**Files:**

- Modify: `docs/api/core.md`
- Modify: `docs/ko/api/core.md`
- Modify: `docs/api/runtime-intercept.md`
- Modify: `docs/ko/api/runtime-intercept.md`
- Modify: `docs/api/react.md`
- Modify: `docs/ko/api/react.md`
- Modify: `docs/guides/library-consumption.md`
- Modify: `docs/ko/guides/library-consumption.md`

**Step 1: Document protocol runtime state**

Add the supported internal `interceptState.protocolRuntime` shape as a preset authoring contract.

**Step 2: Document wallet units**

State that wallet asset balances and allowances are integer base-unit strings.

**Step 3: Document deterministic limitations**

Make clear:

- mock signatures are not cryptographic signatures.
- protocol math is deterministic approximation.
- unsupported ABI selectors fail explicitly.

**Step 4: Verify**

Run:

```bash
pnpm docs:build
```

Expected: PASS.

## Task 11: Full Validation

Run focused validation first:

```bash
pnpm --filter @lunatest/contracts test
pnpm --filter @lunatest/core test
pnpm --filter @lunatest/runtime-intercept test
pnpm --filter @lunatest/react test
pnpm run test:e2e:smoke:ci
pnpm docs:build
```

Then full validation:

```bash
pnpm test:scripts
pnpm lint:workspace-types
pnpm lint:deadcode
pnpm lint:deadcode:strict
pnpm run build:workspace:ci
pnpm run lint:workspace:ci
pnpm run test:workspace:ci
pnpm exec tsc -b tsconfig.workspace.json --pretty false
pnpm pack:check-integrity
pnpm consumer-smoke:pack
pnpm release:publish:dry-run
pnpm run perf:regression:ci
pnpm run perf:absolute:ci
pnpm run test:e2e:extended:ci
CI=1 pnpm changeset status --output=./.changeset-status.json
```

Expected: all pass.

## PR Acceptance Criteria

- Every built-in protocol preset materializes a non-empty support runtime state.
- Every built-in protocol preset has route mocks for protocol calls.
- `window.ethereum`, fetch JSON-RPC, and XHR JSON-RPC can resolve supported protocol calls from the same runtime state.
- Wallet interceptor supports the documented method matrix.
- Unsupported wallet methods and unsupported protocol selectors fail with explicit errors.
- ERC-20 allowance/balance changes are reflected after approve/swap-like transactions.
- Uniswap V3 swap smoke works through built-in preset without hand-written app route mocks.
- Docs state deterministic support boundaries clearly.
- EN and KO docs contain the same support matrix.

## Recommended Commit Slices

1. `docs(protocol): 지원 매트릭스와 완성 기준 정의`
2. `feat(runtime): provider error model과 wallet method 확장`
3. `feat(runtime): protocol runtime resolver 추가`
4. `feat(core): built-in protocol preset state 보강`
5. `feat(runtime): protocol handlers 구현`
6. `test(e2e): protocol wallet smoke 추가`
7. `docs(api): protocol wallet runtime 문서 동기화`

## Risk Notes

- This PR touches contracts, core, runtime-intercept, react, docs, and e2e. It is intentionally broad, but the shared runtime-state seam keeps the changes cohesive.
- Selector-based ABI parsing is brittle if implemented ad hoc. Keep all selectors in one file with tests.
- Avoid adding `ethers` or `viem` to core/runtime unless implementation becomes unsafe without them. Dependency expansion would affect public package size and release risk.
- If the PR grows too large, cut after Task 6 and ship Uniswap V3 as the first complete protocol, but leave the support matrix marking V2/Curve/Aave as L1/L2 until follow-up PRs.
