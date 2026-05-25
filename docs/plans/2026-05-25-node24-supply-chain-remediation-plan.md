# Node 24 Actions and Supply Chain Remediation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove GitHub Actions Node 20 runtime warnings first, then remediate npm dependency risk with explicit supply-chain gates instead of broad latest-version upgrades.

**Architecture:** Split the work into small PRs so workflow runtime migration, safe minor dependency updates, Vite/Vitest security migration, and install-time supply-chain policy can be reviewed independently. Every dependency PR must verify publish age, install-time lifecycle scripts, lockfile diff, and `pnpm audit` impact before merge.

**Tech Stack:** GitHub Actions, pnpm 10, Node.js 24, npm registry metadata, `pnpm audit`, workspace scripts.

---

## Current Findings

| Area | Finding | Decision |
| --- | --- | --- |
| GitHub Actions | Existing workflows still use Node 20-backed action majors such as `actions/checkout@v4`, `actions/setup-node@v4`, and `pnpm/action-setup@v4`. | Update action tags in a workflow-only PR. |
| npm supply chain | May 2026 npm incidents used fresh malicious package versions, `preinstall` hooks, optional `github:` dependencies, and CI token access. | Do not blindly update all packages to latest. Add publish-age and lifecycle checks. |
| Direct dependency freshness | Several safe-looking patch/minor candidates have no install-time scripts, but `@types/react@18.3.29` is too fresh for a 7-day cooldown. | Hold fresh releases until cooldown passes. |
| Current audit | `pnpm audit` reports high/moderate issues through `picomatch`, `vite`, `esbuild`, `postcss`, `smol-toml`, and `ws`. | Treat audit remediation as security work, not cosmetic freshness. |
| Vite/Vitest | Current Vite paths require larger migration to clear known advisories. | Split into a dedicated migration PR. |

## PR 1: GitHub Actions Node 24 Runtime Migration

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/benchmark.yml`
- Modify: `.github/workflows/docs.yml`
- Modify: `.github/workflows/release.yml`
- Modify: `scripts/ci-prebuild-workflows.test.mjs`

**Target action tags:**
- `actions/checkout@v6.0.2`
- `actions/setup-node@v6.4.0`
- `actions/upload-artifact@v7.0.1`
- `actions/upload-pages-artifact@v5.0.0`
- `actions/deploy-pages@v5.0.0`
- `pnpm/action-setup@v6.0.8`
- `changesets/action@v1.8.0`

**Steps:**
1. Add a workflow regression test that fails if known GitHub Actions use non-Node-24 target tags.
2. Run `node --test scripts/ci-prebuild-workflows.test.mjs` and confirm the test fails on old tags.
3. Update workflow action tags only.
4. Run `pnpm test:scripts`.
5. Run `pnpm lint:deadcode`.
6. Open a PR with no npm package updates.

**Acceptance criteria:**
- Workflow action tags match the target list.
- No `package.json` dependency or `pnpm-lock.yaml` update is included.
- `test:scripts` passes locally.
- CI runtime warnings for Node 20-backed action majors are expected to disappear.

## PR 2: Safe Minor/Patch Dependency Remediation

**Candidate updates after metadata check:**
- `@changesets/cli@2.31.0`
- `@types/node@24.12.4`
- `fast-check@4.8.0`
- `zod@4.4.3`
- `tinyglobby@0.2.16`
- `pnpm@10.33.4`
- `knip@5.88.1`

**Hold list:**
- `@types/react@18.3.29` until at least 2026-05-27 KST because it was published on 2026-05-19 17:49 UTC.
- Any package version published within the configured cooldown window.

**Required checks before update:**
1. Run `npm view <pkg>@<version> version time dist.integrity scripts --json`.
2. Reject versions with unexpected `preinstall`, `install`, `postinstall`, or `prepare` scripts unless explicitly reviewed.
3. Verify `pnpm-lock.yaml` does not introduce exotic transitive dependencies.
4. Run `pnpm audit --json` before and after; document advisory delta.
5. Run the full workspace verification set appropriate to dependency scope.

**Refinement after audit delta check:**
- Direct dependency bumps alone do not remove the `picomatch` and `smol-toml` advisories because current safe minor lines still pull vulnerable transitive versions.
- Add targeted `pnpm.overrides` only for vetted patch releases with integrity metadata and no install-time scripts:
  - `picomatch@<2.3.2 -> 2.3.2`
  - `picomatch@>=4.0.0 <4.0.4 -> 4.0.4`
  - `smol-toml@<1.6.1 -> 1.6.1`
  - `postcss@<8.5.10 -> 8.5.10`
  - `ws@>=8.0.0 <8.20.1 -> 8.20.1`
- Keep `vite`/`vitest`/`esbuild` advisories out of PR 2 because that requires the dedicated Vite migration in PR 3.
- Expected audit delta for PR 2:
  - Before: high 4 / moderate 9
  - After: high 2 / moderate 3
  - Remaining: Vite/esbuild family only

## PR 3: Vite/Vitest Security Migration

**Reason:**
Current audit findings include Vite advisories that are not cleanly remediated by staying on the current Vite 5 path. This needs isolated compatibility testing for docs, examples, and Vitest.

**Candidate scope:**
- Upgrade `vite` in `examples/swap-dapp` to a patched line.
- Upgrade `vitest` so its transitive `vite` is patched.
- Upgrade `@vitejs/plugin-react` only after publish-age cooldown and compatibility checks.
- Re-run docs build, example build, workspace tests, and e2e smoke wrappers.

## PR 4: Supply-Chain Policy Hardening

**Candidate policy:**
- Add `minimumReleaseAge: 10080` to `pnpm-workspace.yaml` after confirming CI install behavior.
- Keep `blockExoticSubdeps: true` explicit when compatible with the workspace.
- Document lifecycle script policy and package cooldown exceptions.

**Risk tradeoff:**
- We give up immediate adoption of just-published packages.
- This is acceptable because the project is a public package workspace and recent attacks were caught shortly after publication.
- Revisit if an urgent security patch requires same-day adoption; that exception must be pinned and documented.

## Verification Commands

```bash
pnpm test:scripts
pnpm lint:deadcode
pnpm lint:workspace-types
pnpm -r lint
pnpm exec tsc -b tsconfig.workspace.json --pretty false
pnpm -r build
pnpm -r test
pnpm docs:build
pnpm pack:check-integrity
pnpm consumer-smoke:pack
pnpm audit --json
```
