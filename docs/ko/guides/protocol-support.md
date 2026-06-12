# 프로토콜 및 지갑 지원 범위

LunaTest의 protocol support는 결정론적인 프론트엔드 지원입니다. 체인 포크 없이 Web3 UI 흐름을 재현 가능하게 만드는 것이 목적이며, EVM 노드를 바이트 단위로 흉내 내는 도구가 아닙니다.

## 지원 레벨

| 레벨 | 의미 | LunaTest 계약 |
| ---- | ---- | ------------- |
| L0 | preset metadata만 존재 | registry에는 보이지만 runtime 동작은 설치하지 않습니다. |
| L1 | wallet/session 지원 | EIP-1193 wallet state, account, chain, permission, balance, deterministic transaction이 동작합니다. |
| L2 | read-route 지원 | 자주 쓰는 RPC 또는 contract read를 preset state와 route mock에서 응답합니다. |
| L3 | frontend-flow 지원 | approval, quote, swap, supply, borrow 같은 UI 흐름을 결정론적으로 end-to-end 검증할 수 있습니다. |
| L4 | 정확한 protocol simulation | EVM 실행, 정확한 AMM 수학, mempool, 과거 chain state까지 재현합니다. |

LunaTest built-in preset은 **L3**를 목표로 합니다. 정확한 protocol simulation은 범위 밖입니다. L4 보장이 필요하면 Anvil, Foundry, forked RPC를 사용하세요.

## Built-in protocol preset

| Preset id | 목표 지원 | 결정론 frontend flow | 주요 제한 |
| --------- | --------- | -------------------- | --------- |
| `builtin/uniswap_v2` | L3 | pair reserve read, ERC-20 allowance/balance read, router approval/swap 스타일 transaction, preset state 기반 quote 응답 | router bytecode를 실제 실행하거나 fee-on-transfer token의 모든 edge case를 모델링하지 않습니다. |
| `builtin/uniswap_v3` | L3 | pool metadata, quote/swap 스타일 응답, fee-tier 기반 state, ERC-20 approval/balance read | 전체 tick traversal 또는 Quoter gas 동작을 정확히 재현하지 않습니다. |
| `builtin/curve` | L3 | pool coin/balance/virtual-price read, exchange 스타일 transaction receipt, allowance/balance read | 모든 pool 구현체나 amplification edge case를 재현하지 않습니다. |
| `builtin/aave` | L3 | reserve/account read와 supply, withdraw, borrow, repay 스타일 transaction receipt | liquidation math, interest accrual, pool bytecode 전체 실행은 재현하지 않습니다. |

애플리케이션이 built-in 범위를 벗어난 protocol, selector, state shape에 의존한다면 project-local preset을 추가하세요. [Local Preset 작성](./local-preset-authoring.md)을 참고하면 됩니다.

여러 built-in preset을 실제 주입 provider 경로로 확인하는 runnable 예제는 [DeFi Dashboard Dogfood](./defi-dashboard-dogfood.md)를 참고하세요. 이 예제는 public API로 preset을 materialize하고 L3 경로를 검증하지만, L4 simulation을 주장하지는 않습니다.

## Built-in method matrix

| Preset | 지원 deterministic method/selector |
| ------ | ---------------------------------- |
| `builtin/uniswap_v2` | ERC-20 `symbol`, `decimals`, `balanceOf`, `allowance`, `approve`; pair/factory/router `getPair`, `getReserves`, `getAmountsOut`, `getAmountsIn`, `swapExactTokensForTokens` |
| `builtin/uniswap_v3` | ERC-20 `symbol`, `decimals`, `balanceOf`, `allowance`, `approve`; quoter/pool/router `quoteExactInputSingle`, `quoteExactOutputSingle`, `slot0`, `liquidity`, `exactInputSingle` |
| `builtin/curve` | ERC-20 `symbol`, `decimals`, `balanceOf`, `allowance`, `approve`; pool/router `coins`, `balances`, `get_dy`, `exchange`, `get_virtual_price` |
| `builtin/aave` | ERC-20 `symbol`, `decimals`, `balanceOf`, `allowance`, `approve`; pool/oracle `getUserAccountData`, `getReserveData`, `getAssetPrice`, `supply`, `withdraw`, `borrow`, `repay` |

모든 built-in preset은 `eth_call`, `eth_sendTransaction`, `eth_getTransactionReceipt`, `eth_getLogs`용 protocol runtime route를 함께 설치합니다.

## 지갑 인터셉터 지원

runtime intercept가 활성화되면 브라우저에 EIP-1193 호환 provider test double을 설치합니다.

| 분류 | 지원 method |
| ---- | ----------- |
| Chain/session | `eth_chainId`, `net_version`, `eth_accounts`, `eth_requestAccounts`, `wallet_switchEthereumChain`, `wallet_addEthereumChain` |
| Permission | `wallet_requestPermissions`, `wallet_getPermissions`, `wallet_revokePermissions` |
| Balance/gas/block | `eth_getBalance`, `eth_getTransactionCount`, `eth_blockNumber`, `eth_gasPrice`, `eth_estimateGas`, `eth_feeHistory`, `eth_maxPriorityFeePerGas`, `eth_getBlockByNumber` |
| Protocol/transaction | `eth_call`, `eth_sendTransaction`, `eth_getTransactionReceipt`, `eth_getLogs` |
| Signing/assets | `personal_sign`, `eth_signTypedData_v4`, `wallet_watchAsset` |

negative path는 provider 스타일 error code로 고정합니다.

| Code | 의미 |
| ---- | ---- |
| `4001` | 사용자가 요청을 거절했습니다. |
| `4100` | account 또는 method 권한이 없습니다. |
| `4200` | 지원하지 않는 method입니다. |
| `4900` | provider가 disconnected 상태입니다. |
| `4901` | chain이 disconnected 상태입니다. |
| `4902` | 요청한 chain을 wallet이 알지 못합니다. |

signature와 transaction hash는 결정론 test double입니다. 같은 입력에서는 안정적이지만 private key로 만든 cryptographic signature는 아닙니다.

## Runtime state shape

Protocol preset은 runtime intercept state로 materialize됩니다. 중요한 public shape는 아래와 같습니다.

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

`bootstrapLunaRuntime()`에 `protocolPresetId`를 넘기면 이 state가 자동 적용됩니다. 필요하면 명시적인 `intercept.routes`, `intercept.mockResponses`, project-local preset으로 동작을 덮어쓰거나 확장할 수 있습니다.

wallet token balance와 allowance는 integer base-unit string입니다. 예를 들어 `decimals`가 `6`인 USDC 계열 token에서 `"1000000"`은 1 token을 의미합니다. protocol math는 결정론적 근사이며, 지원하지 않는 selector는 strict mode에서 조용히 forward하지 않고 명시적으로 실패합니다.

## 어떤 테스트 계층을 쓸까

| 필요 | 권장 계층 |
| ---- | --------- |
| 빠른 UI state, wallet state, route behavior, deterministic happy/error path | LunaTest runtime intercept |
| 팀이 직접 소유한 protocol selector 또는 frontend integration behavior | Project-local LunaTest preset |
| 정확한 bytecode, gas, forked liquidity, liquidation, historical chain state | Anvil/Foundry/forked RPC |
