# CI Integration

권장 CI 게이트는 PR 스모크와 야간 확장을 분리합니다.

## PR Required Gates

1. `pnpm -r --filter=!@lunatest/e2e-tests build`
2. `pnpm -r --filter=!@lunatest/e2e-tests lint`
3. `pnpm -r --filter=!@lunatest/e2e-tests test`
4. `pnpm test:e2e:smoke`
5. `node scripts/check-performance.mjs --mode=regression --baseline=scripts/perf-baseline.json --output=scripts/perf-current.json`

## Nightly Gates

1. `node scripts/check-performance.mjs --mode=absolute --output=scripts/perf-current-absolute.json`
2. `pnpm test:e2e:extended`

스모크 게이트는 머지 차단용, 확장 게이트는 리스크 탐지용으로 운용합니다.
