# Sepolia + Uniswap V3 Swap Demo

`examples/swap-dapp` is LunaTest's real-first sample.

- The default path uses a real wallet and real Sepolia transactions.
- The chaos path patches runtime state through preset controls and Lua editing.
- CI runs only tests that do not depend on a network.

Use the [Live Demo](./live-demo.md) to run a deterministic version inside the
documentation SPA. It is built with `VITE_LUNATEST_DEMO_MODE=deterministic`
and does not require a real RPC endpoint or wallet. This guide covers the
real-first path that uses a Sepolia RPC endpoint and wallet.

## What This Demo Covers

1. Token pair, input amount, quote
2. Slippage/gas/network/balance warnings
3. `approve -> swap -> pending -> confirmed/failed` step machine
4. Chaos presets: `high_slippage_80`, `gas_spike_500_gwei`, and `pending_10m`

## Prerequisites

- Optional wallet extension (MetaMask or any EIP-1193 wallet)
- Sepolia ETH for gas
- Token pair addresses that exist on Sepolia
- Node 20+

## 1) Configure Environment

From the repo root:

```bash
pnpm install --frozen-lockfile
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

From the repo root:

```bash
pnpm --filter @lunatest/example-swap-dapp dev
```

Then verify the following in the browser:

1. If you have a real wallet, click `Connect Wallet`
2. If you do not have a wallet, open `LunaTest Devtools` and click `Enable Luna Wallet`
3. Ensure wallet network is Sepolia (`11155111`)
4. Enter amount and click `Quote`
5. If needed, click `Approve`
6. Click `Swap` and observe `Tx Stepper` progression

## 3) Deterministic Chaos QA Loop

In the in-browser panel:

1. Pick preset (`Slippage 80%`, `Gas 500 Gwei`, `Pending 10m`)
2. Click `Apply Preset`
3. Observe warning/button/stepper changes
4. Toggle `Luna Wallet` on or off to exercise the deterministic wallet path without a browser extension
5. Edit Lua text and click `Apply Lua`
6. Check `State Diff` for exact runtime patch output

## 4) Validation Commands

```bash
pnpm lint
pnpm test
pnpm build
```

The local suite is deterministic and network-independent. Real Sepolia transaction checks remain manual smoke tests.
