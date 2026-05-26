# GitHub Pages Docs 404 Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the GitHub Pages deployment that currently serves only `404.html` by ensuring VitePress builds real documentation entrypoints and CI fails on empty Pages artifacts.

**Architecture:** The docs command already sets `docs` as the VitePress root via `vitepress build docs`, so the VitePress config must not re-point `srcDir` to `docs`. The docs workflow should validate that the built Pages artifact contains `index.html` before upload, and docs must avoid VitePress-relative links to files outside the docs root.

**Tech Stack:** VitePress 1.6, GitHub Pages Actions, Node test runner, pnpm workspace.

---

## Current Failure

The latest successful Docs deployment uploaded an artifact that contained:

- `404.html`
- `assets/*`
- `hashmap.json`
- `vp-icons.css`

It did not contain `index.html` or any content page HTML. The deployed URL `https://songforthemute.github.io/lunatest/` therefore returned 404 even though the workflow and Pages deployment both reported success.

## Root Cause

`package.json` runs:

```bash
vitepress build docs
```

But `docs/.vitepress/config.mts` also set:

```ts
srcDir: "docs"
```

This made VitePress look for markdown files under `docs/docs`, which does not exist. VitePress still emitted shell assets and `404.html`, so the workflow succeeded while publishing an unusable site.

## Remediation Steps

### Task 1: Add Regression Coverage

**Files:**

- Create: `scripts/docs-site.test.mjs`
- Modify: `package.json`

**Implementation:**

- Assert `docs:build` remains `vitepress build docs`.
- Assert `docs/.vitepress/config.mts` does not set `srcDir: "docs"`.
- Assert docs do not use VitePress-relative `../../examples/...` links.
- Assert `.github/workflows/docs.yml` checks for `docs/.vitepress/dist/index.html`.

**Validation:**

```bash
node --test scripts/docs-site.test.mjs
pnpm test:scripts
```

### Task 2: Fix VitePress Source Root

**Files:**

- Modify: `docs/.vitepress/config.mts`

**Implementation:**

- Remove `srcDir: "docs"`.
- Keep `base` controlled by `DOCS_BASE`.
- Keep `cleanUrls: true`.

**Validation:**

```bash
DOCS_BASE=/lunatest/ pnpm docs:build
test -f docs/.vitepress/dist/index.html
```

### Task 3: Fix Dead Links Exposed by Real Docs Build

**Files:**

- Modify: `docs/guides/local-preset-authoring.md`
- Modify: `docs/ko/guides/local-preset-authoring.md`

**Implementation:**

- Replace VitePress-relative links to `../../examples/...` with GitHub blob URLs.
- Keep local repo paths in prose/code examples where they are not markdown links.

**Validation:**

```bash
pnpm docs:build
```

### Task 4: Fail CI on Empty Pages Artifacts

**Files:**

- Modify: `.github/workflows/docs.yml`

**Implementation:**

- Add `Verify docs Pages artifact` after `pnpm docs:build`.
- Check:
  - `docs/.vitepress/dist/index.html`
  - `docs/.vitepress/dist/getting-started.html`
  - `docs/.vitepress/dist/ko/index.html`

**Validation:**

```bash
pnpm test:scripts
```

## Full Verification

```bash
pnpm test:scripts
DOCS_BASE=/lunatest/ pnpm docs:build
test -f docs/.vitepress/dist/index.html
test -f docs/.vitepress/dist/getting-started.html
test -f docs/.vitepress/dist/ko/index.html
git diff --check
```

## Acceptance Criteria

- `pnpm docs:build` renders real docs pages.
- `docs/.vitepress/dist/index.html` exists.
- The Docs workflow fails before upload if the Pages artifact lacks an index page.
- GitHub Pages should serve `https://songforthemute.github.io/lunatest/` after the next successful Docs deployment.
