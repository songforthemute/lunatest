# Release Provenance Metadata Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the npm Trusted Publishing failure by ensuring every public package publishes a `repository.url` that matches the GitHub Actions provenance source.

**Architecture:** Keep the existing Release workflow and OIDC trusted publishing path. Add correct package metadata at the source manifests and extend pack integrity checks so the exact tarball metadata is verified before `changesets/action` attempts npm publish.

**Tech Stack:** pnpm workspace, npm Trusted Publishing/OIDC, Node.js script tests, GitHub Actions Release workflow.

---

### Task 1: Add metadata regression coverage

**Files:**
- Create: `scripts/package-metadata.test.mjs`
- Modify: `package.json`

**Steps:**
1. Add a Node test that verifies the root package and every public package has `repository.type = "git"`, `repository.url = "https://github.com/songforthemute/lunatest"`, and the correct `repository.directory` for workspace packages.
2. Add the new test to `test:scripts`.
3. Run `node --test scripts/package-metadata.test.mjs` and confirm it fails before metadata is added.

### Task 2: Add source package metadata

**Files:**
- Modify: `package.json`
- Modify: `packages/*/package.json`

**Steps:**
1. Add root repository metadata.
2. Add package-specific repository metadata to each public package under `packages/*`.
3. Leave private example/e2e packages unchanged unless a later check proves they are part of publish metadata validation.
4. Run `node --test scripts/package-metadata.test.mjs` and confirm it passes.

### Task 3: Verify packed tarball metadata before publish

**Files:**
- Modify: `scripts/check-pack-integrity.mjs`

**Steps:**
1. Extract `package/package.json` from each generated tarball.
2. Validate repository metadata against the expected URL and package directory.
3. Keep existing dist/file allowlist checks intact.
4. Run `pnpm pack:check-integrity` after build output exists.

### Task 4: Document release precondition

**Files:**
- Modify: `docs/guides/ci-integration.md`

**Steps:**
1. Add a short maintainer note that npm Trusted Publishing requires public package `repository.url` to match the GitHub repository.
2. Mention that `pack:check-integrity` guards the packed package metadata before publish.

### Task 5: Verify and publish PR

**Steps:**
1. Run focused checks: `pnpm test:scripts`, `pnpm -r --filter=!@lunatest/e2e-tests build`, `pnpm pack:check-integrity`, `pnpm consumer-smoke:pack`, `pnpm release:publish:dry-run`.
2. Commit with `fix(release): npm provenance metadata 보강`.
3. Push `codex/release-provenance-metadata`.
4. Open a PR targeting `main`.
