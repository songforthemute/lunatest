# Cross-Platform Consumer CI Design

**Status:** Approved

## Goal

Validate the packed-tarball consumer workflow on every supported developer OS: Linux, Windows, and macOS.

## Context

`consumer-smoke:pack` is the public-package acceptance test. It packs every public workspace package, installs those tarballs into isolated React 18 and React 19 consumers, and exercises package entrypoints, CLI commands, MCP JSON-RPC, and watch shutdown. The current CI workflow runs that smoke only on Ubuntu.

The CLI/MCP workflow has platform-specific risk that Linux alone cannot prove:

- Windows package bins normally use `.cmd` shims.
- Windows does not provide POSIX child-process signal behavior.
- Windows, macOS, and Linux differ in path, filesystem watcher, and process-handle behavior.

macOS is an explicit supported developer platform, not a proxy for Linux. It requires its own native runner.

## Decision

Keep the existing Linux `consumer-smoke-pack` job unchanged and add two explicit jobs:

```text
quality (ubuntu-latest)
  |
  +-- consumer-smoke-pack          (ubuntu-latest, existing)
  +-- consumer-smoke-pack-windows  (windows-latest, new)
  +-- consumer-smoke-pack-macos    (macos-latest, new)
  +-- e2e-smoke                    (ubuntu-latest)
  |
  +-- performance-regression       (ubuntu-latest, existing dependencies)
```

The new jobs use the same frozen install, workspace prebuild, and `consumer-smoke:pack` command as Linux. They depend on `quality` and run only for pull requests and pushes to `main`:

```yaml
if: github.event_name == 'pull_request' || github.ref == 'refs/heads/main'
```

This avoids a second Windows/macOS run for every `codex/**` branch push while retaining a PR result and a post-merge result. `workflow_dispatch` follows the selected ref, so manual dispatch on `main` also exercises all three platforms.

## Why Separate Jobs

| Option | Decision | Reason |
| --- | --- | --- |
| Add named Windows/macOS jobs | Chosen | Preserves the existing Linux check identity and makes a failing platform obvious. |
| Convert the Linux job into an OS matrix | Rejected | Changes the existing check name and complicates branch-protection migration. |
| Run Windows/macOS only nightly | Rejected | Allows platform regressions to merge before discovery. |

The release workflow remains Ubuntu-only. It already runs the packed smoke before a publish attempt; duplicating it on two extra runners would make release recovery slower without replacing the PR/main platform gate.

## Scope

Included:

- Two native OS CI jobs in `.github/workflows/ci.yml`.
- Workflow contract tests for both jobs.
- CI guide updates documenting the three-platform consumer gate and its scope.

Excluded:

- Changes to package code, `consumer-smoke:pack`, or release workflow sequencing.
- Adding Windows/macOS to unrelated unit, E2E, benchmark, or docs jobs.
- Enabling GitHub branch protection or rulesets.

## Branch Protection Boundary

`main` currently has no branch protection or repository ruleset. The new jobs will be visible PR/main checks, but they cannot enforce merge blocking until repository policy requires them.

After the new jobs have successful check names on at least one PR, define a separate governance change that configures the entire existing PR gate set together. Do not require only the two new checks, because that would create an inconsistent partial gate.

## Validation

Local validation proves workflow structure and script contracts:

- `pnpm test:scripts`
- `pnpm lint:workspace-types`
- `pnpm docs:build`

GitHub Actions validates the native behavior:

- Linux, Windows, and macOS `consumer-smoke:pack` jobs each install from a fresh checkout.
- Each job completes both React 18 and React 19 tarball consumers.
- Windows confirms direct Node bin execution and stdin-EOF watch shutdown without `.cmd` or POSIX signal assumptions.
- macOS confirms the same public consumer flow on a native Darwin runner.

## Risks And Decisions

| Risk | Mitigation |
| --- | --- |
| Additional hosted-runner time | Run only after `quality`, and only on PR/main rather than every `codex/**` push. |
| Workflow duplication drifts | Cover job names, trigger conditions, setup versions, and commands in `ci-prebuild-workflows.test.mjs`. |
| Native-only failure cannot be reproduced locally | Preserve command output and use the platform-specific Actions job as the acceptance environment. |
| New checks do not block merges by themselves | Keep branch-protection rollout explicit and separate from this code PR. |
