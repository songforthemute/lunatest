# CI Integration

권장 CI 게이트:

1. `pnpm -r lint`
2. `pnpm -r build`
3. `pnpm -r test`
4. `node scripts/check-performance.mjs --mode=regression --baseline=scripts/perf-baseline.json --output=scripts/perf-current.json`

PR 머지 전 성능 회귀를 차단합니다.
