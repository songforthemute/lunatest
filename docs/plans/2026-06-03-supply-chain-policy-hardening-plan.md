# Supply-Chain Policy Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent newly published or exotic transitive dependencies from entering the workspace by default during pnpm installs.

**Architecture:** Keep the policy in `pnpm-workspace.yaml`, where current pnpm reads workspace settings. Mirror the same policy in the temporary consumer smoke workspace so pack smoke exercises the real install guardrails. Cover the policy with script-level regression tests so future dependency work cannot silently remove it.

**Tech Stack:** pnpm 10.33.4, Node.js test runner, VitePress docs, GitHub Actions CI wrappers.

---

## Context

`minimumReleaseAge` is supported by pnpm 10.16.0 and later. `blockExoticSubdeps` is supported by pnpm 10.26.0 and later. LunaTest currently pins `pnpm@10.33.4`, so both policy keys are supported by the configured package manager.

## Tasks

### Task 1: Add Failing Policy Tests

**Files:**
- Modify: `scripts/dependency-policy.test.mjs`

**Steps:**
1. Assert root `pnpm-workspace.yaml` includes `minimumReleaseAge: 10080`.
2. Assert root `pnpm-workspace.yaml` includes `blockExoticSubdeps: true`.
3. Assert `minimumReleaseAgeExclude` is absent by default.
4. Assert `scripts/consumer-smoke-pack.mjs` propagates the same policy into its temporary `pnpm-workspace.yaml`.
5. Run `node --test scripts/dependency-policy.test.mjs` and confirm it fails before implementation.

### Task 2: Apply Workspace Policy

**Files:**
- Modify: `pnpm-workspace.yaml`
- Modify: `scripts/consumer-smoke-pack.mjs`

**Steps:**
1. Add `minimumReleaseAge: 10080`.
2. Add `blockExoticSubdeps: true`.
3. Add the same keys to the consumer smoke workspace template.
4. Run `pnpm config list --location project` and verify pnpm prints `minimum-release-age=10080` and `block-exotic-subdeps=true`.
5. Run `node --test scripts/dependency-policy.test.mjs` and confirm it passes.

### Task 3: Document Maintainer Rules

**Files:**
- Modify: `docs/guides/ci-integration.md`
- Modify: `docs/plans/2026-05-25-node24-supply-chain-remediation-plan.md`
- Create: `docs/plans/2026-06-03-supply-chain-policy-hardening-plan.md`

**Steps:**
1. Document that 10080 minutes means a 7-day npm publish-age gate.
2. Document that `blockExoticSubdeps` blocks transitive exotic specs.
3. Document that `minimumReleaseAgeExclude` must remain narrow and justified.

### Task 4: Verify

Run:

```bash
pnpm install --frozen-lockfile --ignore-scripts
pnpm test:scripts
pnpm lint:deadcode
pnpm lint:workspace-types
pnpm -r lint
pnpm exec tsc -b tsconfig.workspace.json --pretty false
pnpm -r build
pnpm -r test
DOCS_BASE=/lunatest/ pnpm docs:build
pnpm pack:check-integrity
pnpm consumer-smoke:pack
pnpm audit --audit-level=moderate
pnpm release:publish:dry-run
git diff --check
```
