# Getting Started

## 1. Install

```bash
pnpm install
```

## 2. Run Checks

```bash
pnpm -r lint
pnpm -r test
pnpm -r build
```

## 3. Run CLI

```bash
pnpm --filter @lunatest/cli build
node packages/cli/dist/index.js run
node packages/cli/dist/index.js gen --ai
```

## 4. Performance Gate

```bash
node scripts/check-performance.mjs --mode=regression --baseline=scripts/perf-baseline.json --output=scripts/perf-current.json
```
