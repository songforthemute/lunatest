# Protocol and Wallet Support

LunaTest protocol support is deterministic frontend support. It is designed to make Web3 UI flows reproducible without a chain fork, not to emulate an EVM node byte-for-byte.

## Support levels

| Level | Meaning | LunaTest contract |
| ----- | ------- | ----------------- |
| L0 | Preset metadata only | The protocol appears in the registry but does not install runtime behavior. |
| L1 | Wallet/session support | EIP-1193 wallet state, accounts, chain, permissions, balances, and deterministic transactions work. |
| L2 | Read-route support | Common RPC or contract reads are answered from preset state and route mocks. |
| L3 | Frontend-flow support | Deterministic approval, quote, swap, supply, borrow, or equivalent UI flows can be tested end to end. |
| L4 | Exact protocol simulation | Full EVM execution, exact AMM math, mempool behavior, and historical chain state are reproduced. |

LunaTest built-ins target **L3**. Exact protocol simulation remains out of scope; use Anvil, Foundry, or a forked RPC when a test needs L4 guarantees.

## Built-in protocol presets

| Preset id | Target support | Deterministic frontend flows | Main limits |
| --------- | -------------- | ---------------------------- | ----------- |
| `builtin/uniswap_v2` | L3 | Pair reserve reads, ERC-20 allowance/balance reads, router approval/swap-style transactions, quote-like responses seeded from preset state. | Does not run exact router bytecode or model every fee-on-transfer token edge case. |
| `builtin/uniswap_v3` | L3 | Pool metadata, quote/swap-style responses, fee-tier seeded state, ERC-20 approval/balance reads. | Does not reproduce full tick traversal or exact Quoter gas behavior. |
| `builtin/curve` | L3 | Pool coin/balance/virtual-price reads, exchange-style transaction receipts, allowance/balance reads. | Does not reproduce every pool implementation or amplification edge case. |
| `builtin/aave` | L3 | Reserve/account reads plus supply, withdraw, borrow, and repay-style transaction receipts seeded from preset state. | Does not reproduce liquidation math, interest accrual, or full pool bytecode. |

Use project-local presets when your application depends on a protocol, selector, or state shape that is not covered by the built-ins. See [Local Preset Authoring](./local-preset-authoring.md).

For a runnable cross-protocol dogfood app, use [DeFi Dashboard Dogfood](./defi-dashboard-dogfood.md). It materializes every built-in preset through public APIs and verifies the injected provider path without claiming L4 simulation.

## Built-in method matrix

| Preset | Supported deterministic methods/selectors |
| ------ | ----------------------------------------- |
| `builtin/uniswap_v2` | ERC-20 `symbol`, `decimals`, `balanceOf`, `allowance`, `approve`; pair/factory/router `getPair`, `getReserves`, `getAmountsOut`, `getAmountsIn`, `swapExactTokensForTokens` |
| `builtin/uniswap_v3` | ERC-20 `symbol`, `decimals`, `balanceOf`, `allowance`, `approve`; quoter/pool/router `quoteExactInputSingle`, `quoteExactOutputSingle`, `slot0`, `liquidity`, `exactInputSingle` |
| `builtin/curve` | ERC-20 `symbol`, `decimals`, `balanceOf`, `allowance`, `approve`; pool/router `coins`, `balances`, `get_dy`, `exchange`, `get_virtual_price` |
| `builtin/aave` | ERC-20 `symbol`, `decimals`, `balanceOf`, `allowance`, `approve`; pool/oracle `getUserAccountData`, `getReserveData`, `getAssetPrice`, `supply`, `withdraw`, `borrow`, `repay` |

All built-in presets also install protocol runtime routes for `eth_call`, `eth_sendTransaction`, `eth_getTransactionReceipt`, and `eth_getLogs`.

## Wallet interceptor support

The browser runtime installs an EIP-1193-compatible provider test double when runtime intercept is enabled.

| Category | Supported methods |
| -------- | ----------------- |
| Chain/session | `eth_chainId`, `net_version`, `eth_accounts`, `eth_requestAccounts`, `wallet_switchEthereumChain`, `wallet_addEthereumChain` |
| Permissions | `wallet_requestPermissions`, `wallet_getPermissions`, `wallet_revokePermissions` |
| Balances/gas/block | `eth_getBalance`, `eth_getTransactionCount`, `eth_blockNumber`, `eth_gasPrice`, `eth_estimateGas`, `eth_feeHistory`, `eth_maxPriorityFeePerGas`, `eth_getBlockByNumber` |
| Protocol/transactions | `eth_call`, `eth_sendTransaction`, `eth_getTransactionReceipt`, `eth_getLogs` |
| Signing/assets | `personal_sign`, `eth_signTypedData_v4`, `wallet_watchAsset` |

The interceptor uses provider-style error codes for deterministic negative paths:

| Code | Meaning |
| ---- | ------- |
| `4001` | User rejected the request. |
| `4100` | Unauthorized account or method. |
| `4200` | Unsupported method. |
| `4900` | Provider disconnected. |
| `4901` | Chain disconnected. |
| `4902` | Requested chain is unknown to the wallet. |

Signatures and transaction hashes are deterministic test doubles. They are stable for the same input, but they are not cryptographic signatures produced by a private key.

## Runtime state shape

Protocol presets materialize into the runtime intercept state. The important public shape is:

```ts
type ProtocolRuntimeState = {
  activeProtocol: "uniswap_v2" | "uniswap_v3" | "curve" | "aave";
  supportLevel: "L3";
  chainId: number;
  contracts: Record<string, string>;
  tokens: Record<string, { symbol?: string; decimals?: number }>;
  transactionBehavior?: {
    forcePending?: boolean;
    forceRevert?: boolean;
    userRejectedMethods?: string[];
  };
  uniswapV2?: unknown;
  uniswapV3?: unknown;
  curve?: unknown;
  aave?: unknown;
};
```

`bootstrapLunaRuntime()` applies this state automatically when you pass `protocolPresetId`. You can still override or extend behavior with explicit `intercept.routes`, `intercept.mockResponses`, and project-local presets.

Wallet token balances and allowances are integer base-unit strings. For example, `"1000000"` means one USDC-style token when `decimals` is `6`. Protocol math is deterministic approximation; unsupported selectors fail explicitly instead of silently forwarding in strict mode.

## Choosing the right test layer

| Need | Recommended layer |
| ---- | ----------------- |
| Fast UI state, wallet state, route behavior, deterministic happy/error paths | LunaTest runtime intercept |
| Protocol selector or frontend integration behavior that your team owns | Project-local LunaTest preset |
| Exact bytecode, gas, forked liquidity, liquidation, or historical chain state | Anvil/Foundry/forked RPC |
