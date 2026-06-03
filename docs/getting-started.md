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

No-RPC/no-wallet 문서 데모는 [Live Demo](./guides/live-demo.md)에서 바로 실행할 수 있습니다.

Swap 데모(실지갑 + Sepolia + Uniswap V3)는
[Sepolia Swap Demo Guide](./guides/swap-demo-sepolia-uniswapv3.md)에서 확인할 수 있습니다.

팀 전용 protocol / wallet preset을 직접 작성하려면
[Local Preset Authoring Guide](./guides/local-preset-authoring.md)를 참고하세요.

## 3. Run Local Checks

```bash
pnpm lint:workspace-types
pnpm -r lint
pnpm -r build
pnpm -r test
```

`pnpm lint:workspace-types` verifies that workspace package typechecking does not depend on prebuilt `dist` artifacts.

## 4. Run Release Gates

```bash
pnpm lint:deadcode
pnpm pack:check-integrity
```

## 5. Run CLI

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

`lunatest gen --ai` requires `lunatest.config.json` to define `ai.command`. Without that field, the command exits early instead of generating scenarios.

## 6. Run Performance Gate

```bash
node scripts/check-performance.mjs --mode=regression --baseline=scripts/perf-baseline.json --output=scripts/perf-current.json
```

## 7. CI Wrappers

CI/nightly jobs should use the wrapper commands below instead of invoking E2E or performance checks directly:

```bash
pnpm run build:workspace:ci
pnpm run lint:workspace:ci
pnpm run test:workspace:ci
pnpm run test:e2e:smoke:ci
pnpm run test:e2e:extended:ci
pnpm run perf:regression:ci
pnpm run perf:absolute:ci
```

`test:e2e:*` checks workspace-source integration behavior. Use `pnpm consumer-smoke:pack` or `pnpm consumer-smoke:npm` when you need to verify package public entrypoints from a packed tarball or npm registry.
