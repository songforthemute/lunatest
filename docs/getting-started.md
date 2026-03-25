# Getting Started

## 1. Install

```bash
pnpm install
```

## 2. Install Libraries (Consumer Projects)

```bash
pnpm add @lunatest/core @lunatest/react
pnpm add @lunatest/runtime-intercept
pnpm add @lunatest/mcp
pnpm add -D @lunatest/vitest-plugin
```

Package status: `Published` (stable packages available on npm).

실사용 예제는 [Library Consumption Guide](./guides/library-consumption.md)에서 확인할 수 있습니다.

Swap 데모(실지갑 + Sepolia + Uniswap V3)는
[Sepolia Swap Demo Guide](./guides/swap-demo-sepolia-uniswapv3.md)에서 확인할 수 있습니다.

팀 전용 protocol / wallet preset을 직접 작성하려면
[Local Preset Authoring Guide](./guides/local-preset-authoring.md)를 참고하세요.

## 3. Run Checks

```bash
pnpm lint:workspace-types
pnpm -r lint
pnpm -r test
pnpm -r build
```

`pnpm lint:workspace-types` verifies that workspace package typechecking does not depend on prebuilt `dist` artifacts.

## 4. Run CLI

```bash
pnpm --filter @lunatest/cli build
node packages/cli/dist/index.js run
node packages/cli/dist/index.js gen --ai
```

## 5. Run Performance Gate

```bash
node scripts/check-performance.mjs --mode=regression --baseline=scripts/perf-baseline.json --output=scripts/perf-current.json
```
