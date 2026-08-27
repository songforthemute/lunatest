# Getting Started

## Use LunaTest in an Existing App

```bash
pnpm add @lunatest/core @lunatest/react @lunatest/mcp
pnpm add @lunatest/runtime-intercept
pnpm add -D @lunatest/vitest-plugin @lunatest/playwright-plugin
```

All public LunaTest packages, including the Vitest and Playwright integrations, publish on `latest`.

For scenario commands, use the installed public CLI rather than a repository
build artifact:

```bash
pnpm add -D @lunatest/cli
pnpm exec lunatest validate
pnpm exec lunatest run
```

For runnable library examples, see the [Library Consumption Guide](./guides/library-consumption.md).
The [CLI workflow](./guides/cli-workflow.md) covers configuration and every CLI command.
The [Live Demo](./guides/live-demo.md) runs without an RPC endpoint or wallet.
For complete applications, see [DeFi Dashboard Dogfood](./guides/defi-dashboard-dogfood.md)
and the [Sepolia Swap Demo Guide](./guides/swap-demo-sepolia-uniswapv3.md).

## Contribute to the Repository

Repository CI uses Node 24 and pnpm 10.33.4 as its baseline. This is the
repository's CI/tooling baseline, not a claim that every published package
requires Node 24.

If your Node 24 installation includes Corepack, enable it and let the
repository's `packageManager` field select pnpm 10.33.4:

```bash
corepack enable
corepack install
```

If Corepack is unavailable or unsuitable for your environment, install the
same pnpm version by another supported means, for example:

```bash
npm install --global pnpm@10.33.4
```

Install the repository dependencies and run local contributor checks:

```bash
pnpm install --frozen-lockfile
pnpm -r lint
pnpm run build
pnpm -r test
pnpm test:e2e:smoke
```

These are the local developer commands. `pnpm test:e2e:smoke` loads built workspace package entries, so run it after `pnpm run build`, which serializes workspace build writers. Use `pnpm test:e2e:extended` for the local extended suite when you need it.

### Run Local Performance Checks

Build the workspace first, then run the runner directly when investigating performance locally:

```bash
pnpm run build
node scripts/check-performance.mjs --mode=regression --baseline=scripts/perf-baseline.json --output=scripts/perf-current.json
node scripts/check-performance.mjs --mode=absolute --output=scripts/perf-current-absolute.json
```

Regression mode fails when p95 exceeds 110% of the checked-in baseline. Absolute mode has fixed limits: p95 must be below `1ms`, and 1,000 scenarios must finish below `1000ms`. The runner retries once before failing; it does not accept a configurable `--threshold` option.

### Reproduce Fresh-Checkout CI

The `*:ci` scripts are CI contracts. They centralize the build required in a fresh checkout, where workspace `dist` artifacts do not exist. Run them locally only when reproducing a CI job:

```bash
pnpm lint:workspace-types
pnpm run build:workspace:ci
pnpm run lint:workspace:ci
pnpm run test:workspace:ci
pnpm lint:deadcode
pnpm pack:check-integrity
pnpm run test:e2e:smoke:ci
pnpm run perf:regression:ci
```

When manually dispatched as needed, the Benchmark workflow runs:

```bash
pnpm run test:e2e:extended:ci
pnpm run perf:absolute:ci
```

`lint:workspace-types` temporarily removes package `dist` directories before linting. `consumer-smoke:pack` is a separate packed-tarball consumer check and is preceded by `pnpm run build:workspace:ci` in each Linux, Windows, and macOS CI job. Use `pnpm consumer-smoke:npm` only to verify registry consumption after publication.

For the complete job graph, platform conditions, and release policy, see [CI Integration](./guides/ci-integration.md).

### Build the Documentation Site

```bash
pnpm docs:dev
pnpm docs:build
```
