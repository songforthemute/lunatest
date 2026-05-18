# Release and Docs Deploy Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore npm release and GitHub Pages docs deployment after the PR #3 merge.

**Architecture:** Keep the existing release and docs workflows, but fix the two deployment-only failures at their source. Changesets should resolve the custom changelog module from `.changeset`, and the docs deploy job should fail with an explicit Pages setup message before calling `actions/deploy-pages` when GitHub Pages is disabled.

**Tech Stack:** GitHub Actions, Changesets, VitePress, Node.js test runner.

---

### Task 1: Guard Changesets changelog resolution

**Files:**
- Modify: `.changeset/config.json`
- Create: `scripts/changeset-config.test.mjs`
- Modify: `package.json`

**Steps:**
- Add a Node test that resolves the configured changelog module from the `.changeset` directory.
- Change the changelog module path from `./.changeset/changelog.cjs` to `./changelog.cjs`.
- Keep `releaseNoteTemplate` rooted at the repository root because `.changeset/changelog.cjs` resolves that option with `process.cwd()`.
- Include the new test in `pnpm test:scripts`.

### Task 2: Guard GitHub Pages deploy preflight

**Files:**
- Modify: `.github/workflows/docs.yml`
- Modify: `scripts/ci-prebuild-workflows.test.mjs`

**Steps:**
- Add a workflow regression test that requires a Pages preflight before `actions/deploy-pages`.
- Add a deploy job step that calls `gh api repos/${GITHUB_REPOSITORY}/pages`.
- If Pages is not configured, fail with the repo settings URL because the default workflow token cannot reliably create a Pages site.

### Task 3: Verify and publish PR

**Commands:**
- `pnpm test:scripts`
- `pnpm docs:build`
- `pnpm lint:deadcode`
- `pnpm lint:workspace-types`
- `pnpm -r lint`
- `pnpm -r build`
- `pnpm -r test`
- `pnpm pack:check-integrity`
- `pnpm consumer-smoke:pack`
- `CI=1 pnpm changeset status --output=./.changeset-status.json`
- `pnpm release:publish:dry-run`

**Acceptance Criteria:**
- Release no longer fails while resolving `.changeset/changelog.cjs`.
- Docs deploy no longer reaches `actions/deploy-pages` with Pages disabled, and reports the exact settings page that must be enabled.
- Existing quality, pack, e2e, and docs build gates remain green.
