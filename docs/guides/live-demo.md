# Live Demo

<script setup>
import { withBase } from 'vitepress'
</script>

The live demo embeds `examples/swap-dapp` as a deterministic documentation sub-app.

- No Sepolia RPC key is required.
- No browser wallet extension is required.
- LunaTest enables a seeded Luna Wallet session.
- Quote, approve, swap, runtime state diff, chaos presets, and Lua editing remain interactive.

Open the demo in a new tab if the embedded frame feels cramped:
<a :href="withBase('/examples/swap-dapp/')" target="_blank" rel="noreferrer">Open live demo</a>.

<div class="live-demo-frame-shell">
  <iframe
    :src="withBase('/examples/swap-dapp/')"
    title="LunaTest deterministic swap live demo"
    loading="lazy"
    class="live-demo-frame"
  ></iframe>
</div>

## What Is Deterministic Here?

The docs build sets `VITE_LUNATEST_DEMO_MODE=deterministic` for the embedded app.
That mode provides Sepolia-shaped fixture addresses, enables Luna runtime intercept in production docs builds, and seeds a connected Luna Wallet session.

The app still exercises the same UI flow:

1. Click `Connect Wallet`.
2. Click `Quote`.
3. Click `Approve` when allowance is required.
4. Click `Swap`.
5. Apply chaos presets or edit Lua to patch runtime state.

## Real Sepolia Flow

Use the [Sepolia swap demo guide](./swap-demo-sepolia-uniswapv3.md) when you want to run the same app against a real wallet, real RPC endpoint, and real Uniswap V3 Sepolia contracts.

<style>
.live-demo-frame-shell {
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
  box-shadow: 0 18px 44px rgb(0 0 0 / 12%);
  background: var(--vp-c-bg-soft);
}

.live-demo-frame {
  display: block;
  width: 100%;
  min-height: 860px;
  border: 0;
}

@media (max-width: 768px) {
  .live-demo-frame {
    min-height: 980px;
  }
}
</style>
