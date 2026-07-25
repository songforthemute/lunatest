# Cross-Platform Consumer CI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Run LunaTest's packed-tarball consumer smoke on Linux, Windows, and macOS for pull requests and `main` pushes.

**Architecture:** Preserve the existing Ubuntu consumer job and add named Windows/macOS jobs after `quality`. Each new job uses the existing `consumer-smoke:pack` command so the consumer fixture and React peer matrix remain one source of truth. Restrict the two new jobs to PR/main events to avoid duplicate platform runs from `codex/**` branch pushes.

**Tech Stack:** GitHub Actions, pnpm 10.33.4, Node.js 24, Node.js test runner, VitePress.

---

### Task 1: Lock the workflow contract with failing tests

**Files:**
- Modify: `scripts/ci-prebuild-workflows.test.mjs`

**Step 1: Write the failing workflow test**

Add a test that reads `.github/workflows/ci.yml` and checks both job names:

```js
for (const [job, runner] of [
  ["consumer-smoke-pack-windows", "windows-latest"],
  ["consumer-smoke-pack-macos", "macos-latest"],
]) {
  assert.match(ciWorkflow, new RegExp(`${job}:\\n\\s+if: github\\.event_name == 'pull_request' \\|\\| github\\.ref == 'refs/heads/main'`));
  assert.match(ciWorkflow, new RegExp(`${job}:\\n[\\s\\S]*?runs-on: ${runner}`));
  assert.match(ciWorkflow, new RegExp(`${job}:\\n[\\s\\S]*?needs: quality`));
  assert.match(ciWorkflow, new RegExp(`${job}:\\n[\\s\\S]*?pnpm install --frozen-lockfile`));
  assert.match(ciWorkflow, new RegExp(`${job}:\\n[\\s\\S]*?pnpm run build:workspace:ci`));
  assert.match(ciWorkflow, new RegExp(`${job}:\\n[\\s\\S]*?pnpm consumer-smoke:pack`));
}
```

Also assert that the existing `consumer-smoke-pack` job remains on `ubuntu-latest` and that `performance-regression` retains its current dependencies. This prevents the platform addition from silently changing Linux check identity or expanding the performance critical path.

**Step 2: Run the test to verify it fails**

Run:

```bash
node --test scripts/ci-prebuild-workflows.test.mjs
```

Expected: FAIL because neither named cross-platform job exists.

**Step 3: Commit the RED test**

```bash
git add scripts/ci-prebuild-workflows.test.mjs
git commit -m "test(ci): 플랫폼 consumer gate 계약 추가"
```

### Task 2: Add native Windows and macOS consumer jobs

**Files:**
- Modify: `.github/workflows/ci.yml`

**Step 1: Add the Windows job**

After the existing `consumer-smoke-pack` job, add:

```yaml
  consumer-smoke-pack-windows:
    if: github.event_name == 'pull_request' || github.ref == 'refs/heads/main'
    runs-on: windows-latest
    needs: quality
    steps:
      - uses: actions/checkout@v6.0.2
      - uses: pnpm/action-setup@v6.0.8
        with:
          version: 10.33.4
      - uses: actions/setup-node@v6.4.0
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run build:workspace:ci
      - run: pnpm consumer-smoke:pack
```

Do not set `shell`, do not invoke `.cmd` directly, and do not duplicate the smoke command in PowerShell. The script owns the OS-specific bin resolution.

**Step 2: Add the macOS job**

Add an equivalent `consumer-smoke-pack-macos` job with:

```yaml
    if: github.event_name == 'pull_request' || github.ref == 'refs/heads/main'
    runs-on: macos-latest
    needs: quality
```

Use the same action versions and commands as Windows and Linux.

**Step 3: Run the workflow test to verify it passes**

Run:

```bash
node --test scripts/ci-prebuild-workflows.test.mjs
```

Expected: PASS, including the new cross-platform job assertions.

**Step 4: Commit the workflow implementation**

```bash
git add .github/workflows/ci.yml scripts/ci-prebuild-workflows.test.mjs
git commit -m "ci(consumer): Windows macOS tarball smoke 추가"
```

### Task 3: Document the three-platform CI contract

**Files:**
- Modify: `docs/guides/ci-integration.md`

**Step 1: Update the PR gate explanation**

Keep the existing `pnpm consumer-smoke:pack` command in the gate list. Update the consumer-smoke paragraph to state:

- Linux remains the original `consumer-smoke-pack` job.
- Windows and macOS jobs execute the same packed-tarball consumer flow after `quality`.
- They run on PRs and `main`, not every `codex/**` push.
- The three jobs validate public package entrypoints, CLI/MCP bins, and React 18/19.
- Repository branch protection is a separate policy decision; visible checks are not automatically required checks.

**Step 2: Build documentation**

Run:

```bash
pnpm docs:build
```

Expected: PASS.

**Step 3: Commit the documentation**

```bash
git add docs/guides/ci-integration.md
git commit -m "docs(ci): 플랫폼 consumer gate 안내 추가"
```

### Task 4: Run local regression checks

**Files:**
- No source changes expected.

**Step 1: Run workflow and script tests**

Run:

```bash
pnpm test:scripts
```

Expected: PASS.

**Step 2: Run workspace and documentation checks**

Run:

```bash
pnpm lint:workspace-types
pnpm -r lint
pnpm docs:build
```

Expected: PASS.

**Step 3: Check patch hygiene**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors and only intended workflow, test, documentation, and plan files.

### Task 5: Verify native runners and document branch-protection follow-up

**Files:**
- No repository source change required.

**Step 1: Open a PR and inspect the three consumer jobs**

Verify these checks all succeed:

```text
consumer-smoke-pack
consumer-smoke-pack-windows
consumer-smoke-pack-macos
```

Each must show both React 18 and React 19 consumer success messages.

**Step 2: Verify the post-merge `main` run**

Run:

```bash
gh run list --branch main --workflow ci.yml --limit 10
```

Expected: the new Windows and macOS jobs run after `quality` on `main`.

**Step 3: Record the policy handoff**

Do not change branch protection in this PR. Create or schedule a separate repository-governance task to require the full existing PR gate set plus the two new consumer checks after their check names have been observed successfully.

## Full Verification

```bash
pnpm test:scripts
pnpm lint:workspace-types
pnpm -r lint
pnpm docs:build
git diff --check
```

## Acceptance Criteria

- Linux `consumer-smoke-pack` check name and Ubuntu runner remain unchanged.
- Windows and macOS have named `consumer-smoke:pack` jobs on native runners.
- Both new jobs require `quality` and use the frozen install, shared workspace build wrapper, and shared consumer smoke command.
- The new jobs run for PRs and `main` pushes, but not `codex/**` branch pushes.
- `performance-regression` does not gain Windows/macOS as dependencies.
- CI guide describes the platform scope and branch-protection boundary accurately.
- PR and post-merge CI prove the consumer workflow on all three OS runners.
