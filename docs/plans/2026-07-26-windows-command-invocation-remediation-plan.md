# Windows Command Invocation Remediation Plan

> **For Codex:** Implement with test-first changes and retain the native Windows CI gate as the acceptance test.

**Goal:** Make repository build scripts invoke pnpm safely on Windows and report child-process startup failures instead of exiting without diagnostics.

**Architecture:** Reuse the existing `resolveCommandInvocation()` contract from `scripts/smoke-helpers.mjs` through a small, testable build-command runner. Example and documentation build scripts will resolve pnpm through `cmd.exe /d /c pnpm.cmd` only on Windows, retain direct invocation on Unix, and report `spawnSync` errors while allowing output streams to drain before exit.

**Tech Stack:** Node.js ESM scripts, node:test, pnpm, GitHub Actions Windows runner.

---

### Task 1: Add the regression contract

**Files:**
- Create: `scripts/build-command.mjs`
- Create: `scripts/example-build-scripts.test.mjs`

1. Assert a simulated Windows pnpm spawn uses `cmd.exe /d /c pnpm.cmd` and returns an actionable spawn diagnostic.
2. Assert both Vite example build wrappers delegate pnpm through the testable runner.
3. Assert they do not call `spawnSync("pnpm", ...)` directly and use `process.exitCode` so diagnostics are not truncated.
4. Assert the documentation build runner uses the same runner and short-circuits after a failure.
5. Run the test directly and confirm it fails against the current raw invocation code.

### Task 2: Route build scripts through the existing resolver

**Files:**
- Create: `scripts/build-command.mjs`
- Modify: `examples/defi-dashboard/scripts/build.mjs`
- Modify: `examples/swap-dapp/scripts/build.mjs`
- Modify: `scripts/build-docs-site.mjs`

1. Add a command runner that resolves pnpm and returns buffered output, exit status, and a formatted spawn diagnostic.
2. Resolve every pnpm command before `spawnSync`, preserving `shell: false`.
3. Print a command-specific failure when `spawnSync` returns `error`; preserve normal stdout, stderr, exit status, and browser-externalization checks.
4. Run the new test and `pnpm test:scripts` to verify the regression contract.

### Task 3: Verify the release path and native runners

**Files:**
- No source changes expected unless the audit finds a workflow-relevant caller.

1. Audit other direct pnpm child-process invocations and include only callers that are cross-platform build paths.
2. Run `pnpm -r lint`, `pnpm run build:workspace:ci`, `pnpm docs:build`, and `pnpm consumer-smoke:pack`.
3. Push the PR update and require all Linux, macOS, and Windows consumer jobs to succeed. Do not exclude examples or weaken the workflow.

### Task 4: Keep packed tarball overrides independent of absolute temp paths

**Files:**
- Modify: `scripts/pnpm-workspace-overrides.mjs`
- Modify: `scripts/consumer-smoke-pack.mjs`
- Modify: `scripts/dependency-policy.test.mjs`

1. Generate each `file:` override relative to its matrix consumer workspace instead of from an absolute `file://` URI.
2. Normalize Windows separators to `/` so the YAML target has no drive path, backslash escaping, or encoded short-path characters.
3. Reproduce POSIX and Windows `RUNNER~1` temp paths and assert the rendered value is `file:../../tarballs/...`; reject cross-drive paths that cannot be represented relative to the consumer workspace.
4. Re-run the Windows native consumer job through the existing PR gate.
