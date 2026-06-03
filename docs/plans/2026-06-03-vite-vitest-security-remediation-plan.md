# Vite, esbuild, and Vitest Security Remediation Plan

**Goal:** Clear the current dev-tooling advisories without adopting just-published major releases or changing public package APIs.

**Scope:** Root tooling, workspace package manager policy, the private swap example, and lockfile resolution.

---

## Findings

| Area | Finding | Decision |
| --- | --- | --- |
| Vite 5 path | `examples/swap-dapp` and `vitepress@1.6.4` previously resolved `vite@5.4.21`, which pulled `esbuild@0.21.5`. | Move the workspace to a patched Vite 6 line and force vulnerable Vite ranges through overrides. |
| Vitest path | `vitest@3.2.4` previously resolved vulnerable Vite versions and now triggers a critical `vitest <4.1.0` advisory. | Pin all workspace Vitest dev dependencies to `4.1.0`, the oldest patched line verified in the registry. |
| Latest versions | `vite@8.0.16` and `vitest@4.1.8` were published on 2026-06-01, less than the supply-chain cooldown window. | Do not adopt latest major/patch releases in this remediation PR. |
| pnpm overrides | Current pnpm warns that `package.json`'s `pnpm.overrides` field is ignored. | Move overrides to `pnpm-workspace.yaml`, the active workspace settings location. |

## Implementation

1. Move existing security overrides from `package.json` to `pnpm-workspace.yaml`.
2. Add Vite advisory overrides:
   - `vite@<=6.4.1 -> 6.4.2`
   - `vite@>=7.0.0 <=7.3.1 -> 7.3.3`
3. Pin `examples/swap-dapp` direct Vite dependency to `6.4.2`.
4. Pin root, e2e, and swap example Vitest dependencies to `4.1.0`.
5. Regenerate `pnpm-lock.yaml`.
6. Add dependency policy regression tests that fail if:
   - overrides move back to `package.json`
   - required workspace overrides disappear
   - vulnerable Vite, esbuild, or Vitest lockfile entries return

## Conscious Debt

The Vite override intentionally normalizes transitive Vite peer ranges to `6.4.2`, including VitePress' Vite dependency. This gives up strict adherence to every transitive package's declared range. It is acceptable for this PR because the docs build and example build are verified against the resolved graph, while the previous graph has known advisories.

Recover this debt when VitePress stable supports a newer Vite line directly or when a follow-up Vite 8/Vitest 4 migration passes the supply-chain cooldown and compatibility checks.

## Verification

```bash
node --test scripts/dependency-policy.test.mjs
pnpm test:scripts
pnpm audit --audit-level=moderate
pnpm run build:workspace:ci
pnpm --filter @lunatest/example-swap-dapp test
pnpm --filter @lunatest/example-swap-dapp build
DOCS_BASE=/lunatest/ pnpm docs:build
pnpm lint:deadcode
pnpm lint:workspace-types
pnpm -r lint
pnpm exec tsc -b tsconfig.workspace.json --pretty false
pnpm -r build
pnpm -r test
pnpm pack:check-integrity
pnpm consumer-smoke:pack
pnpm release:publish:dry-run
git diff --check
```
