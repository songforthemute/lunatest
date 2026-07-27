# Getting Started

## 1. Install the Repository

```bash
pnpm install --frozen-lockfile
```

## 2. Install Libraries in a Consumer Project

```bash
pnpm add @lunatest/core @lunatest/react @lunatest/mcp
pnpm add @lunatest/runtime-intercept
pnpm add -D @lunatest/vitest-plugin@next @lunatest/playwright-plugin@next
```

`@lunatest/contracts`, `@lunatest/core`, `@lunatest/runtime-intercept`, `@lunatest/cli`, `@lunatest/react`, and `@lunatest/mcp` publish on `latest`. The Vitest and Playwright integrations publish on `next`, so their installation commands must keep the explicit `@next` tag until they are promoted to `latest`.

For runnable library examples, see the [Library Consumption Guide](./guides/library-consumption.md). The [Live Demo](./guides/live-demo.md) runs without an RPC endpoint or wallet. For complete applications, see [DeFi Dashboard Dogfood](./guides/defi-dashboard-dogfood.md) and the [Sepolia Swap Demo Guide](./guides/swap-demo-sepolia-uniswapv3.md).

## 3. Run Local Checks

```bash
pnpm -r lint
pnpm -r build
pnpm -r test
pnpm test:e2e:smoke
```

These are the local developer commands. `pnpm test:e2e:smoke` loads built workspace package entries, so run it after `pnpm -r build`. Use `pnpm test:e2e:extended` for the local extended suite when you need it.

## 4. Run the CLI

If you plan to use `gen --ai`, define `ai.command` in `lunatest.config.json`:

```json
{
  "ai": {
    "command": "node",
    "args": ["./adapter.mjs"]
  }
}
```

```bash
pnpm --filter @lunatest/cli build
node packages/cli/dist/index.js run
node packages/cli/dist/index.js gen --ai
```

`lunatest gen --ai` sends scenario, coverage, preset-catalog, and prompt data to the external adapter. It exits without generating scenarios when `ai.command` is absent.

## 5. Run Local Performance Checks

Build the workspace first, then run the runner directly when investigating performance locally:

```bash
pnpm -r build
node scripts/check-performance.mjs --mode=regression --baseline=scripts/perf-baseline.json --output=scripts/perf-current.json
node scripts/check-performance.mjs --mode=absolute --output=scripts/perf-current-absolute.json
```

Regression mode fails when p95 exceeds 110% of the checked-in baseline. Absolute mode has fixed limits: p95 must be below `1ms`, and 1,000 scenarios must finish below `1000ms`. The runner retries once before failing; it does not accept a configurable `--threshold` option.

## 6. Reproduce Fresh-Checkout CI

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

The scheduled Benchmark workflow additionally runs:

```bash
pnpm run test:e2e:extended:ci
pnpm run perf:absolute:ci
```

`lint:workspace-types` temporarily removes package `dist` directories before linting. `consumer-smoke:pack` is a separate packed-tarball consumer check and is preceded by `pnpm run build:workspace:ci` in each Linux, Windows, and macOS CI job. Use `pnpm consumer-smoke:npm` or `pnpm consumer-smoke:npm:next` only to verify registry consumption after publication.

For the complete job graph, platform conditions, and release policy, see [CI Integration](./guides/ci-integration.md).

## 7. Build the Documentation Site

```bash
pnpm docs:dev
pnpm docs:build
```
