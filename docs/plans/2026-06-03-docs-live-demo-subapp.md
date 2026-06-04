# Docs Live Demo Sub-App Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship the swap example inside the documentation SPA as a deterministic, no-RPC, no-real-wallet live demo.

**Architecture:** Keep VitePress as the documentation app and build `examples/swap-dapp` as a static sub-app under `docs/.vitepress/dist/examples/swap-dapp`. Add a deterministic demo mode to the example app so docs builds can run without Sepolia environment variables, while local real-Sepolia usage remains unchanged.

**Tech Stack:** VitePress, Vite React, Vitest, Node script orchestration, GitHub Pages.

---

### Task 1: Deterministic Demo Config

**Files:**
- Modify: `examples/swap-dapp/src/config/network.ts`
- Test: `examples/swap-dapp/src/config/__tests__/network.test.ts`

**Step 1: Write the failing test**

Add tests that assert:
- `VITE_LUNATEST_DEMO_MODE=deterministic` returns a valid config without Sepolia env.
- normal mode still reports missing env.
- deterministic mode has a placeholder RPC URL and the Sepolia chain fixture addresses.

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @lunatest/example-swap-dapp test -- src/config/__tests__/network.test.ts`

Expected: fail because the test file or behavior does not exist.

**Step 3: Write minimal implementation**

Add:
- `SwapRuntimeMode = "real" | "deterministic"`
- `DETERMINISTIC_SWAP_CONFIG`
- `isDeterministicDemoMode(env)`
- `loadSwapEnvConfig()` branch for deterministic mode

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @lunatest/example-swap-dapp test -- src/config/__tests__/network.test.ts`

Expected: pass.

### Task 2: Deterministic Wallet Session Seed

**Files:**
- Create: `examples/swap-dapp/src/demo/session.ts`
- Test: `examples/swap-dapp/src/demo/__tests__/session.test.ts`
- Modify: `examples/swap-dapp/src/main.tsx`
- Modify: `examples/swap-dapp/src/app.tsx`

**Step 1: Write the failing test**

Add tests that assert:
- deterministic session is enabled and connected.
- chain id is Sepolia hex `0xaa36a7`.
- token assets use the configured token addresses.
- account permission includes `eth_accounts`.

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @lunatest/example-swap-dapp test -- src/demo/__tests__/session.test.ts`

Expected: fail because `createDeterministicWalletSession` does not exist.

**Step 3: Write minimal implementation**

Add `createDeterministicWalletSession(config)` and call `setWalletSession()` after `bootstrapLunaRuntime()` resolves when deterministic mode is active.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @lunatest/example-swap-dapp test -- src/demo/__tests__/session.test.ts`

Expected: pass.

### Task 3: Docs Build Orchestration

**Files:**
- Create: `scripts/build-docs-site.mjs`
- Modify: `package.json`
- Modify: `scripts/docs-site.test.mjs`
- Modify: `.github/workflows/docs.yml`

**Step 1: Write the failing test**

Update `scripts/docs-site.test.mjs` so it expects:
- `docs:build` uses `node scripts/build-docs-site.mjs`.
- the build script builds VitePress and the swap example.
- the docs workflow validates `docs/.vitepress/dist/examples/swap-dapp/index.html`.
- the docs workflow path filters include `examples/swap-dapp/**` and `scripts/build-docs-site.mjs`.

**Step 2: Run test to verify it fails**

Run: `node --test scripts/docs-site.test.mjs`

Expected: fail against current package/workflow.

**Step 3: Write minimal implementation**

Create `scripts/build-docs-site.mjs`:
- run `pnpm run build:workspace:ci` so Docs workflow works from a fresh checkout.
- run `vitepress build docs`.
- compute example base from `DOCS_BASE`.
- run example typecheck.
- run Vite build for `examples/swap-dapp` with `VITE_LUNATEST_DEMO_MODE=deterministic`, `--emptyOutDir false`, and outDir `../../docs/.vitepress/dist/examples/swap-dapp`.

**Step 4: Run test to verify it passes**

Run: `node --test scripts/docs-site.test.mjs`

Expected: pass.

### Task 4: Documentation Pages

**Files:**
- Create: `docs/guides/live-demo.md`
- Create: `docs/ko/guides/live-demo.md`
- Modify: `docs/.vitepress/config.mts`
- Modify: `docs/guides/swap-demo-sepolia-uniswapv3.md`
- Modify: `docs/ko/guides/swap-demo-sepolia-uniswapv3.md`

**Step 1: Update docs**

Add a live-demo page with:
- iframe pointing to `../examples/swap-dapp/`.
- explicit deterministic mode description.
- note that real Sepolia flow remains in the Sepolia guide.

**Step 2: Wire navigation**

Add English and Korean sidebar/nav entries.

**Step 3: Validate docs build**

Run: `DOCS_BASE=/lunatest/ pnpm docs:build`

Expected:
- `docs/.vitepress/dist/index.html` exists.
- `docs/.vitepress/dist/examples/swap-dapp/index.html` exists.

### Task 5: Full Verification and PR

**Files:**
- All changed files.

**Step 1: Run targeted checks**

Run:
- `pnpm --filter @lunatest/example-swap-dapp test`
- `pnpm --filter @lunatest/example-swap-dapp build`
- `node --test scripts/docs-site.test.mjs`
- `pnpm test:scripts`
- `DOCS_BASE=/lunatest/ pnpm docs:build`

**Step 2: Run broader checks**

Run:
- `pnpm lint:deadcode`
- `pnpm lint:workspace-types`
- `pnpm -r lint`
- `pnpm exec tsc -b tsconfig.workspace.json --pretty false`

**Step 3: Commit and PR**

Commit: `feat(docs): 예제 앱 라이브 데모 포함`

Push branch and create a ready PR to `main`.
