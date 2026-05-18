# CI Integration

권장 CI 구성은 PR 스모크 게이트와 야간 확장 게이트를 분리해 운영하는 방식입니다.

## PR Required Gates

1. `pnpm lint:workspace-types`
2. `pnpm -r --filter=!@lunatest/e2e-tests build`
3. `pnpm -r --filter=!@lunatest/e2e-tests lint`
4. `pnpm -r --filter=!@lunatest/e2e-tests test`
5. `pnpm lint:deadcode`
6. `pnpm pack:check-integrity`
7. `pnpm consumer-smoke:pack`
8. `pnpm run test:e2e:smoke:ci`
9. `pnpm run perf:regression:ci`

## Nightly Gates

1. `pnpm run perf:absolute:ci`
2. `pnpm run test:e2e:extended:ci`

PR에서는 머지를 막아야 할 리스크를 빠르게 잡고, 야간 배치에서는 확장 시나리오로 품질 저하를 조기에 탐지합니다.
`consumer-smoke-pack` job은 quality 이후에 실행되며, publish 전 패키지 소비 검증을 담당합니다. `performance-regression`는 이 job과 `e2e-smoke`가 끝난 뒤에만 실행됩니다.

`pnpm lint:workspace-types`는 workspace 패키지의 `dist` 산출물을 임시로 제거한 상태에서 lint를 다시 실행해,
fresh checkout에서도 내부 타입 해석이 build artifact에 의존하지 않는다는 점을 검증합니다.

CI 전용 wrapper script(`build:workspace:ci`, `test:e2e:*:ci`, `perf:*:ci`)는 fresh checkout에서 필요한 prebuild coupling을 중앙화합니다. `main` 브랜치 릴리스와 PR CI 모두 이 wrapper를 기준으로 E2E와 성능 게이트를 실행합니다.
로컬 개발에서는 기존 `test:e2e:smoke`, `test:e2e:extended`를 그대로 써도 됩니다.

## Release Authentication

- `main` 릴리스 파이프라인은 npm Trusted Publishing(GitHub OIDC)을 사용합니다.
- 장기 `NPM_TOKEN` publish 비밀값에 의존하지 않으며, GitHub Actions의 `id-token: write` 권한이 필요합니다.
- npm provenance 검증을 통과하려면 각 공개 패키지의 `package.json`에 있는 `repository.url`이 GitHub repository(`https://github.com/songforthemute/lunatest`)와 일치해야 합니다.
- `pnpm pack:check-integrity`는 publish 전에 tarball 내부 `package.json`의 repository metadata까지 검증합니다. 새 공개 패키지를 추가할 때는 package manifest와 pack integrity 대상 목록을 함께 갱신해야 합니다.
