# Sepolia + Uniswap V3 Swap Demo

`examples/swap-dapp`는 LunaTest의 `Real-first` 샘플입니다.

- 기본 경로: 실지갑 + Sepolia 실 트랜잭션
- 카오스 경로: 프리셋 버튼 + Lua 편집으로 런타임 상태 패치
- CI 경로: 네트워크 비의존 테스트만 자동 실행

## What This Demo Covers

1. Token pair, input amount, quote
2. Slippage/gas/network/balance warnings
3. `approve -> swap -> pending -> confirmed/failed` step machine
4. Chaos presets:
- `high_slippage_80`
- `gas_spike_500_gwei`
- `pending_10m`

## Prerequisites

- MetaMask (or EIP-1193 wallet)
- Sepolia ETH for gas
- Token pair addresses that exist on Sepolia
- Node 20+

## 1) Configure Environment

```bash
cd examples/swap-dapp
cp .env.example .env.local
```

Required env:

- `VITE_SEPOLIA_RPC_URL`
- `VITE_UNISWAP_V3_FACTORY`
- `VITE_UNISWAP_V3_ROUTER`
- `VITE_UNISWAP_V3_QUOTER_V2`
- `VITE_TOKEN_IN`
- `VITE_TOKEN_OUT`
- `VITE_POOL_FEE`

If any field is missing/invalid, the app renders a configuration error screen with missing keys.

## 2) Run the Demo

```bash
pnpm install
pnpm dev
```

Then in browser:

1. `Connect Wallet`
2. Ensure wallet network is Sepolia (`11155111`)
3. Enter amount and click `Quote`
4. If needed, click `Approve`
5. Click `Swap` and observe `Tx Stepper` progression

## 3) Chaos QA Loop

In the in-browser panel:

1. Pick preset (`Slippage 80%`, `Gas 500 Gwei`, `Pending 10m`)
2. Click `Apply Preset`
3. Observe warning/button/stepper changes
4. Edit Lua text and click `Apply Lua`
5. Check `State Diff` for exact runtime patch output

## 4) Validation Commands

```bash
pnpm lint
pnpm test
pnpm build
```

The local suite is deterministic and network-independent. Real Sepolia transaction checks remain manual smoke tests.
