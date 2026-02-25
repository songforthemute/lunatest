# Getting Started

## 1. Install

```bash
pnpm install
```

## 2. Library Install (Consumer Projects)

```bash
pnpm add @lunatest/core @lunatest/react
pnpm add @lunatest/mcp
pnpm add -D @lunatest/vitest-plugin @lunatest/playwright-plugin
```

실사용 예제는 [Library Consumption Guide](./guides/library-consumption.md)에서 확인할 수 있습니다.

## 3. Run Checks

```bash
pnpm -r lint
pnpm -r test
pnpm -r build
```

## 4. Run CLI

```bash
pnpm --filter @lunatest/cli build
node packages/cli/dist/index.js run
node packages/cli/dist/index.js gen --ai
```

## 5. Performance Gate

```bash
node scripts/check-performance.mjs --mode=regression --baseline=scripts/perf-baseline.json --output=scripts/perf-current.json
```
