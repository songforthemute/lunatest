# CI Integration

LunaTest separates fast local iteration from fresh-checkout CI. Local commands assume that you have already built the workspace. CI jobs each start from a new checkout, so the repository defines `*:ci` wrapper scripts to establish the required package artifacts in one place.

## Local Commands

Use the direct commands during normal development:

```sh
pnpm -r lint
pnpm -r build
pnpm -r test
pnpm test:e2e:smoke
pnpm test:e2e:extended
pnpm test:browser
```

The direct E2E commands load workspace package entries and therefore require the preceding build. To investigate performance locally, build first and invoke the runner directly:

```sh
pnpm -r build
node scripts/check-performance.mjs --mode=regression --baseline=scripts/perf-baseline.json --output=scripts/perf-current.json
node scripts/check-performance.mjs --mode=absolute --output=scripts/perf-current-absolute.json
```

## Fresh-Checkout CI Contracts

Use the following commands to reproduce a CI job locally. They are intentionally separate from the fast local workflow:

```sh
pnpm lint:workspace-types
pnpm run build:workspace:ci
pnpm run lint:workspace:ci
pnpm run test:workspace:ci
pnpm lint:deadcode
pnpm pack:check-integrity
pnpm run test:e2e:smoke:ci
pnpm run test:browser:ci
pnpm run perf:regression:ci
```

The scheduled Benchmark workflow also runs:

```sh
pnpm run test:e2e:extended:ci
pnpm run perf:absolute:ci
```

`build:workspace:ci`, `lint:workspace:ci`, and `test:workspace:ci` exclude the root workspace package and `@lunatest/e2e-tests`, preventing recursive root scripts from re-running the full workspace. The E2E and performance CI wrappers run `build:workspace:ci` themselves. `lint:workspace-types` temporarily moves package `dist` directories away before linting, proving that workspace type resolution does not depend on prebuilt artifacts.

## Pull Request Workflow

`.github/workflows/ci.yml` runs these jobs:

1. `quality` runs `lint:workspace-types`, the CI build/lint/test wrappers, `lint:deadcode`, and `pack:check-integrity`.
2. `consumer-smoke-pack` runs on Linux after `quality`; Windows and macOS packed-consumer jobs run for pull requests and `main`.
3. `e2e-smoke` runs `pnpm run test:e2e:smoke:ci` after `quality`.
4. `browser-scenario` runs on Linux after `quality`, installs Chromium with Playwright, then invokes `pnpm run test:browser:ci`.
5. `performance-regression` runs for pull requests and pushes after `quality`, Linux packed-consumer smoke, and E2E smoke. It invokes `pnpm run perf:regression:ci`.

Every job installs with `pnpm install --frozen-lockfile`. Packed-consumer jobs explicitly run `pnpm run build:workspace:ci` before `pnpm consumer-smoke:pack`.

`test:e2e:*` validates workspace-source integration. `consumer-smoke:pack` validates public package entrypoints by installing local tarballs for every stable and next public package across React 18 and React 19 peer combinations. It is not a replacement for registry consumption testing.

`test:browser` runs the Chromium scenario contract. Before running it locally, install the matching browser binary with `pnpm --filter @lunatest/e2e-tests exec playwright install chromium`. Browser installation is intentionally restricted to the Linux CI job; the Windows and macOS consumer jobs stay browser-free.

## Nightly Benchmark Workflow

`.github/workflows/benchmark.yml` runs daily at `00:00 UTC` and can also be started manually. It has two Ubuntu jobs:

1. `nightly-performance` runs `pnpm run perf:absolute:ci` and uploads `scripts/perf-current-absolute.json`.
2. `nightly-e2e-extended` runs `pnpm run test:e2e:extended:ci`.

## Performance Contract

The performance runner warms up, measures 200 scenarios for p95, and measures 1,000 scenarios for total duration. If a check fails, it performs one retry before reporting failure.

- Regression mode fails when p95 exceeds 110% of `scripts/perf-baseline.json`.
- Absolute mode fails when p95 is `>= 1ms` or 1,000 scenarios take `>= 1000ms`.

These limits are fixed in `scripts/check-performance.mjs`; `--threshold` is not a supported option.

## Packed and npm Consumer Checks

Use the commands according to the artifact you want to verify:

```sh
# Local tarballs; run after the CI workspace build when reproducing the CI job.
pnpm run build:workspace:ci
pnpm consumer-smoke:pack

# Published registry packages after a release.
pnpm consumer-smoke:npm -- --tag=latest
pnpm consumer-smoke:npm:next
```

The release workflow runs the same fresh-checkout quality contracts, then packed-consumer smoke. After the Changesets publish action completes on a publish path, it runs the npm smoke checks for `latest` and `next`.

## Supply-Chain Install Policy

`pnpm-workspace.yaml` sets `minimumReleaseAge: 10080`, so new npm versions must age for seven days before installation. `blockExoticSubdeps: true` blocks transitive `github:`, remote-tarball, and local-path dependency specifications.

Do not add a broad allowlist for an exception. For an urgent security patch that must bypass the age gate, record the version and rationale in the PR and use a narrowly scoped `minimumReleaseAgeExclude` entry. Update `scripts/dependency-policy.test.mjs` with that policy change.

## Release Authentication

- The `main` release workflow uses npm Trusted Publishing through GitHub OIDC and requires `id-token: write`.
- It does not use a long-lived `NPM_TOKEN` publish secret.
- Each published package must keep its `repository.url` aligned with `https://github.com/songforthemute/lunatest` for npm provenance.
- `pnpm pack:check-integrity` verifies packed `package.json` metadata and the manifest's `main`, `types`, `exports`, and `bin` targets before publish.

## Documentation and Post-Merge Monitoring

The Docs workflow builds on pull requests and deploys only after a `main` push. Its path filters include documentation sources, the runnable swap and DeFi-dashboard examples, docs build scripts, and package-lock inputs. Deployment verifies GitHub Pages is enabled and smoke-tests the deployed live demo.

After merging, confirm that workflows were created for the merge commit. If an automation token did not create a run, dispatch the relevant workflow from `main`:

```sh
gh run list --commit <merge-sha> --limit 20
gh workflow run ci.yml --ref main
gh workflow run docs.yml --ref main
gh workflow run release.yml --ref main
```

Manual dispatch evaluates the current `main` state. Run `release.yml` manually only when you intend to repeat the release path.

## Maintenance Rules

- Add a root script only with corresponding README and CI-guide updates.
- Update `scripts/package-roster.mjs`, pack/npm smoke coverage, and package metadata checks when public packages or release channels change.
- Update both English and Korean API references whenever a public export surface changes.
- Keep example README paths repository-relative; never add machine-local absolute paths.
