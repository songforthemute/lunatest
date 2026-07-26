# Post-Merge Workflow Hardening Plan

## Summary

PR #20 merge commit `765f23c05eb6cac06ddcb266b7459f271e00a01e` did not create new `main` workflow runs or check runs after merge. The immediate product risk is not package logic; it is operational visibility and deploy reliability after automation-driven merges.

This plan hardens the workflow layer so maintainers can recover deterministically when a `main` push event is suppressed or otherwise fails to enqueue.

## Evidence

- `gh run list --commit 765f23c05eb6cac06ddcb266b7459f271e00a01e` returned no runs.
- The commit check-runs API returned an empty list for that merge commit.
- `ci.yml` and `docs.yml` had `push` triggers but no `workflow_dispatch` fallback.
- `release.yml` already had `workflow_dispatch`.
- `docs.yml` path filters included `examples/swap-dapp/**` but omitted `examples/defi-dashboard/**`, even though the docs site now links to and builds that runnable example.

## Implementation Plan

1. Add `workflow_dispatch` to CI and Docs workflows.
2. Keep Release workflow's existing `workflow_dispatch` fallback and cover it with script tests.
3. Add `examples/defi-dashboard/**` to Docs workflow `pull_request` and `push` path filters.
4. Add script tests that assert critical workflows expose manual dispatch fallback.
5. Add script tests that assert Docs path filters track runnable example apps.
6. Document post-merge monitoring and manual dispatch recovery commands in the CI guide.

## Verification Plan

1. Run `pnpm test:scripts` to validate workflow and docs-policy assertions.
2. Run `pnpm docs:build` to verify the updated CI guide still builds in the docs site.
3. Run `git diff --check` to catch whitespace or patch hygiene issues.
4. Open a PR against `main` and monitor checks.

## Operational Guidance

After a merge to `main`, inspect runs for the merge commit. If no run appears, dispatch the intended workflow manually from `main`:

```sh
gh run list --commit <merge-sha> --limit 20
gh workflow run ci.yml --ref main
gh workflow run docs.yml --ref main
gh workflow run release.yml --ref main
```

Only dispatch `release.yml` when the intended operation is to run the current `main` release path.
