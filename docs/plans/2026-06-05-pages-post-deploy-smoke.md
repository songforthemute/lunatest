# Pages Post-Deploy Smoke Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automatically verify the deployed GitHub Pages live demo after docs deployment.

**Architecture:** Add a small Node smoke script that checks the deployed Pages URL over HTTP and validates the live demo prerequisites: docs page exists, embedded app page exists, and `lunatest.lua` is served with the expected scenario source. Wire it into the Docs workflow after `deploy-pages` so it only runs when the deployed URL is available.

**Tech Stack:** GitHub Actions, Node 24 built-in `fetch`, existing `node --test` script tests.

---

### Task 1: Script/workflow contract test

**Files:**
- Modify: `scripts/docs-site.test.mjs`
- Modify: `.github/workflows/docs.yml`
- Create: `scripts/check-docs-live-demo.mjs`

**Steps:**
1. Add a failing `docs-site.test.mjs` assertion that expects a `scripts/check-docs-live-demo.mjs` script and a Docs workflow smoke step after deploy.
2. Run `pnpm test:scripts` and verify it fails because the script/workflow do not exist yet.
3. Implement the smoke script with deterministic URL checks.
4. Wire the Docs workflow deploy job to run the script with `DOCS_SITE_URL` set from the deploy step page URL output.
5. Run `pnpm test:scripts` and verify it passes.

### Task 2: Local smoke against deployed Pages

**Files:**
- Test: `scripts/check-docs-live-demo.mjs`

**Steps:**
1. Run `DOCS_SITE_URL=https://songforthemute.github.io/lunatest/ node scripts/check-docs-live-demo.mjs`.
2. Verify it passes against the current deployed site.
3. Run with a known bad URL if needed to confirm explicit failure output.

### Task 3: Final verification and PR

**Files:**
- All changed files

**Steps:**
1. Run `pnpm test:scripts`.
2. Run `git diff --check`.
3. Commit with `ci(docs): Pages 라이브 데모 smoke 추가`.
4. Push `codex/pages-post-deploy-smoke` and create a PR into `main`.
