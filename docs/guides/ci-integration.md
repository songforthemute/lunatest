# CI Integration

권장 CI 구성은 PR 스모크 게이트와 야간 확장 게이트를 분리해 운영하는 방식입니다.

## PR Required Gates

1. `pnpm -r --filter=!@lunatest/e2e-tests build`
2. `pnpm -r --filter=!@lunatest/e2e-tests lint`
3. `pnpm -r --filter=!@lunatest/e2e-tests test`
4. `pnpm test:e2e:smoke`
5. `node scripts/check-performance.mjs --mode=regression --baseline=scripts/perf-baseline.json --output=scripts/perf-current.json`

## Nightly Gates

1. `node scripts/check-performance.mjs --mode=absolute --output=scripts/perf-current-absolute.json`
2. `pnpm test:e2e:extended`

PR에서는 머지를 막아야 할 리스크를 빠르게 잡고, 야간 배치에서는 확장 시나리오로 품질 저하를 조기에 탐지합니다.
