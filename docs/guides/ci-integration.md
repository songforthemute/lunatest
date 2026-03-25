# CI Integration

권장 CI 구성은 PR 스모크 게이트와 야간 확장 게이트를 분리해 운영하는 방식입니다.

## PR Required Gates

1. `pnpm lint:workspace-types`
2. `pnpm -r --filter=!@lunatest/e2e-tests build`
3. `pnpm -r --filter=!@lunatest/e2e-tests lint`
4. `pnpm -r --filter=!@lunatest/e2e-tests test`
5. `pnpm test:e2e:smoke`
6. `node scripts/check-performance.mjs --mode=regression --baseline=scripts/perf-baseline.json --output=scripts/perf-current.json`

## Nightly Gates

1. `node scripts/check-performance.mjs --mode=absolute --output=scripts/perf-current-absolute.json`
2. `pnpm test:e2e:extended`

PR에서는 머지를 막아야 할 리스크를 빠르게 잡고, 야간 배치에서는 확장 시나리오로 품질 저하를 조기에 탐지합니다.

`pnpm lint:workspace-types`는 workspace 패키지의 `dist` 산출물을 임시로 제거한 상태에서 lint를 다시 실행해,
fresh checkout에서도 내부 타입 해석이 build artifact에 의존하지 않는다는 점을 검증합니다.

## Release Authentication

- `main` 릴리스 파이프라인은 npm Trusted Publishing(GitHub OIDC)을 사용합니다.
- 장기 `NPM_TOKEN` publish 비밀값에 의존하지 않으며, GitHub Actions의 `id-token: write` 권한이 필요합니다.
