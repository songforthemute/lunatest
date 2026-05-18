# CI Integration

권장 CI 구성은 PR 스모크 게이트와 야간 확장 게이트를 분리해 운영하는 방식입니다.

## PR Required Gates

1. `pnpm lint:workspace-types`
2. `pnpm run build:workspace:ci`
3. `pnpm run lint:workspace:ci`
4. `pnpm run test:workspace:ci`
5. `pnpm lint:deadcode`
6. `pnpm pack:check-integrity`
7. `pnpm consumer-smoke:pack`
8. `pnpm run test:e2e:smoke:ci`
9. `pnpm run perf:regression:ci`

## Nightly Gates

1. `pnpm run perf:absolute:ci`
2. `pnpm run test:e2e:extended:ci`

PR에서는 머지를 막아야 할 리스크를 빠르게 잡고, 야간 배치에서는 확장 시나리오로 품질 저하를 조기에 탐지합니다.
`test:e2e:*`는 workspace source integration 경로를 검증합니다. 패키지 public entrypoint 소비 검증은 `consumer-smoke:pack`과 `consumer-smoke:npm`이 담당합니다.
`consumer-smoke-pack` job은 quality 이후에 실행되며, publish 전 tarball 소비 검증을 담당합니다. `performance-regression`는 이 job과 `e2e-smoke`가 끝난 뒤에만 실행됩니다.

`pnpm lint:workspace-types`는 workspace 패키지의 `dist` 산출물을 임시로 제거한 상태에서 lint를 다시 실행해,
fresh checkout에서도 내부 타입 해석이 build artifact에 의존하지 않는다는 점을 검증합니다.
`pnpm lint:deadcode`는 빠른 PR gate로 unused file drift를 확인합니다. 더 넓은 unused export/dependency 감사가 필요할 때는 `pnpm lint:deadcode:strict`를 수동 또는 릴리스 전 점검으로 실행합니다.

CI 전용 wrapper script(`build:workspace:ci`, `lint:workspace:ci`, `test:workspace:ci`, `test:e2e:*:ci`, `perf:*:ci`)는 fresh checkout에서 필요한 prebuild coupling을 중앙화합니다. `build/lint/test:workspace:ci`는 root workspace package와 `@lunatest/e2e-tests`를 명시적으로 제외해 root recursive script가 다시 전체 workspace를 실행하지 않도록 고정합니다. `main` 브랜치 릴리스와 PR CI 모두 이 wrapper를 기준으로 workspace quality, E2E, 성능 게이트를 실행합니다.
로컬 개발에서는 기존 `test:e2e:smoke`, `test:e2e:extended`를 그대로 써도 됩니다.
Workspace orchestration은 현재 pnpm wrapper를 기준으로 운영하며, 별도 turbo pipeline은 유지하지 않습니다.

## Release Authentication

- `main` 릴리스 파이프라인은 npm Trusted Publishing(GitHub OIDC)을 사용합니다.
- 장기 `NPM_TOKEN` publish 비밀값에 의존하지 않으며, GitHub Actions의 `id-token: write` 권한이 필요합니다.
- npm provenance 검증을 통과하려면 각 공개 패키지의 `package.json`에 있는 `repository.url`이 GitHub repository(`https://github.com/songforthemute/lunatest`)와 일치해야 합니다.
- `pnpm pack:check-integrity`는 publish 전에 tarball 내부 `package.json`의 repository metadata까지 검증합니다. 새 공개 패키지를 추가할 때는 `scripts/package-roster.mjs`와 package manifest를 함께 갱신해야 합니다.
- release workflow는 Changesets가 version PR을 만드는 단계(`hasChangesets == 'true'`)에서는 npm smoke를 건너뜁니다. version PR merge 후 실제 publish 경로에서는 `pnpm consumer-smoke:npm -- --tag=latest`와 `pnpm consumer-smoke:npm:next`를 실행해 npm registry 소비 경로를 검증합니다.

## Maintenance Rules

- 새 root script를 추가하면 README와 이 CI guide의 command list를 함께 갱신합니다.
- 공개 패키지를 추가하거나 release channel을 바꾸면 `scripts/package-roster.mjs`를 먼저 갱신하고 pack/npm smoke와 metadata test가 같은 roster를 보게 합니다.
- public export surface를 바꾸면 EN/KO API reference를 같이 갱신합니다.
- example README에는 machine-local absolute path를 쓰지 않고 repo-relative path만 사용합니다.
