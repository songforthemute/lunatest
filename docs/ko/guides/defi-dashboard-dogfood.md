# DeFi Dashboard Dogfood

`examples/defi-dashboard`는 여러 built-in protocol preset을 실제 React 앱 흐름에서 검증하는 runnable 예제입니다. 앱이 protocol 내부 구현을 직접 가져오지 않고, 주입된 EIP-1193 provider를 통해 LunaTest runtime intercept와 통신한다는 점이 핵심입니다.

브라우저 지갑, RPC key, chain fork 없이 여러 DeFi protocol의 결정론 frontend flow를 빠르게 확인하고 싶을 때 이 가이드를 사용하세요.

## 확인하는 범위

| Protocol | 검증하는 결정론 경로 |
| -------- | -------------------- |
| Uniswap V2 | `getAmountsOut`, ERC-20 `approve`, router swap 스타일 transaction, receipt |
| Uniswap V3 | Quoter V2 `quoteExactInputSingle`, ERC-20 `approve`, `exactInputSingle`, receipt |
| Curve | `get_dy`, ERC-20 `approve`, `exchange`, receipt |
| Aave | `getUserAccountData`, `supply`, receipt |

이 앱은 LunaTest의 **L3 frontend-flow support**를 검증합니다. 정확한 EVM simulation, AMM math, gas behavior, forked liquidity, historical chain state를 보장한다는 의미는 아닙니다.

## 실행

repo root에서:

```bash
pnpm install --frozen-lockfile
pnpm --filter @lunatest/example-defi-dashboard dev
```

명령이 출력하는 Vite URL을 브라우저에서 여세요. 기본 포트는 `5175`입니다.

## 검증

repo root에서:

```bash
pnpm --filter @lunatest/example-defi-dashboard test
pnpm --filter @lunatest/example-defi-dashboard build
```

테스트는 모든 built-in protocol preset을 materialize하고, runtime intercept state를 설치한 뒤, `window.ethereum.request`를 실제로 호출하고 dashboard evidence를 server-render합니다.

## Public API 경로

dogfood flow는 의도적으로 공개 package entrypoint만 사용합니다.

```ts
const { createPresetRegistry, materializeProtocolPreset } = await import("@lunatest/core/browser");
```

```ts
import {
  applyInterceptState,
  connectWalletSession,
  enableLunaRuntimeIntercept,
  setRouteMocks,
  setWalletSession,
} from "@lunatest/runtime-intercept";
```

preset을 materialize한 뒤 생성된 route mock, intercept state, wallet session을 설치합니다. 이후 protocol call은 `window.ethereum.request`를 통해 실행되어 실제 frontend integration 경로와 같은 표면을 사용합니다.

## 언제 이 예제를 쓰나

| 필요 | 사용 |
| ---- | ---- |
| 여러 protocol의 deterministic smoke coverage | `examples/defi-dashboard` |
| 실지갑 + Sepolia + Uniswap V3 수동 흐름 | `examples/swap-dapp` |
| 정확한 protocol bytecode, gas, forked liquidity, liquidation math | Anvil, Foundry, forked RPC |

전체 지원 범위는 [프로토콜/지갑 지원 범위](./protocol-support.md)를 참고하세요.
