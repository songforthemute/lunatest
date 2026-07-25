# CI Integration

권장 CI 구성은 PR 스모크 게이트와 야간 확장 게이트를 분리해 운영하는 방식입니다.
로컬 개발 명령은 빠른 반복을 우선하고, fresh checkout에서 실행되는 CI는 필요한 prebuild를 명시적으로 수행합니다.

## PR Required Gates

1. `pnpm lint:workspace-types`
2. `pnpm run build:workspace:ci`
3. `pnpm run lint:workspace:ci`
4. `pnpm run test:workspace:ci`
5. `pnpm lint:deadcode`
6. `pnpm pack:check-integrity`
7. Linux packed consumer smoke (`consumer-smoke-pack`)
8. Windows packed consumer smoke (`consumer-smoke-pack-windows`)
9. macOS packed consumer smoke (`consumer-smoke-pack-macos`)
10. `pnpm run test:e2e:smoke:ci`
11. `pnpm run perf:regression:ci`

## Nightly Gates

1. `pnpm run perf:absolute:ci`
2. `pnpm run test:e2e:extended:ci`

PR에서는 머지를 막아야 할 리스크를 빠르게 잡고, 야간 배치에서는 확장 시나리오로 품질 저하를 조기에 탐지합니다.
`test:e2e:*`는 workspace source integration 경로를 검증합니다. 패키지 public entrypoint 소비 검증은 `consumer-smoke:pack`과 `consumer-smoke:npm`이 담당합니다.
`consumer-smoke:pack`은 stable/next 공개 패키지를 모두 로컬 tarball로 설치하고 React 18/19 peer 조합에서 public package entrypoint, CLI bin, MCP bin, plugin entrypoint를 검증합니다.

## Local Commands and CI Preconditions

로컬 개발에서는 기존 `test:e2e:smoke`, `test:e2e:extended`를 그대로 사용해 빠르게 반복할 수 있습니다. packed consumer 검증을 로컬에서 재현할 때는 CI와 같은 prebuild를 먼저 실행합니다.

```sh
pnpm run build:workspace:ci
pnpm consumer-smoke:pack
```

CI 전용 wrapper script(`build:workspace:ci`, `lint:workspace:ci`, `test:workspace:ci`, `test:e2e:*:ci`, `perf:*:ci`)는 fresh checkout에서 필요한 prebuild coupling을 중앙화합니다. `build/lint/test:workspace:ci`는 root workspace package와 `@lunatest/e2e-tests`를 명시적으로 제외해 root recursive script가 다시 전체 workspace를 실행하지 않도록 고정합니다. `test:e2e:*:ci`와 `perf:*:ci`는 wrapper 안에서 build를 수행합니다. consumer smoke job은 각 runner에서 `pnpm run build:workspace:ci`를 실행한 다음 `pnpm consumer-smoke:pack`을 실행합니다.

## Cross-Platform Packed Consumer Gates

`consumer-smoke-pack`은 기존 Linux gate이며 Ubuntu에서 `quality` 이후 실행됩니다. `consumer-smoke-pack-windows`와 `consumer-smoke-pack-macos`는 같은 tarball 소비 검증을 각각 Windows와 macOS에서 native로 실행합니다. 세 gate는 Linux, Windows, macOS의 package resolution과 public entrypoint 소비 경로를 함께 확인합니다.

Windows/macOS native gate는 pull request, `main` push, 그리고 `main` ref를 선택한 manual dispatch에서만 실행합니다. feature branch push와 feature ref를 선택한 manual dispatch에서는 PR 실행과 중복되는 native runner 비용을 피하기 위해 의도적으로 건너뜁니다. Release workflow는 계속 Ubuntu에서만 실행됩니다.

`performance-regression`는 Linux `consumer-smoke-pack`과 `e2e-smoke`가 끝난 뒤에만 실행됩니다. Windows/macOS gate를 성능 측정의 선행 조건으로 추가하지 않아, native platform 검증과 성능 회귀 측정의 목적 및 비용을 분리합니다.

Workflow가 성공해도 그 자체로 merge를 강제하지는 않습니다. GitHub branch protection 또는 ruleset에서 required check를 별도로 구성하기 전까지는 필수 gate가 아닙니다. 이 enforcement 설정은 workflow 변경과 분리된 governance 작업으로 관리합니다.

`pnpm lint:workspace-types`는 workspace 패키지의 `dist` 산출물을 임시로 제거한 상태에서 lint를 다시 실행해,
fresh checkout에서도 내부 타입 해석이 build artifact에 의존하지 않는다는 점을 검증합니다.
`pnpm lint:deadcode`는 빠른 PR gate로 unused file drift를 확인합니다. 더 넓은 unused export/dependency 감사가 필요할 때는 `pnpm lint:deadcode:strict`를 수동 또는 릴리스 전 점검으로 실행합니다.

Workspace orchestration은 현재 pnpm wrapper를 기준으로 운영하며, 별도 turbo pipeline은 유지하지 않습니다.

## Post-Merge Monitoring

머지 후에는 merge commit 기준으로 `main` workflow가 실제로 생성됐는지 확인합니다. 자동화 토큰으로 만든 이벤트는 GitHub Actions가 새 workflow run을 만들지 않는 경우가 있으므로, run이 없으면 `workflow_dispatch` fallback으로 필요한 workflow를 수동 실행합니다.

```sh
gh run list --commit <merge-sha> --limit 20
gh workflow run ci.yml --ref main
gh workflow run docs.yml --ref main
gh workflow run release.yml --ref main
```

수동 dispatch는 현재 `main`의 상태를 기준으로 실행됩니다. `release.yml`은 실제 릴리스 경로를 다시 실행해야 할 때만 dispatch합니다.
Docs workflow의 path filter는 docs source뿐 아니라 docs site가 빌드하거나 링크하는 runnable example(`examples/swap-dapp/**`, `examples/defi-dashboard/**`)도 포함해야 합니다.

## Supply-Chain Install Policy

`pnpm-workspace.yaml`은 npm registry에서 새로 발행된 버전을 바로 받지 않도록 `minimumReleaseAge: 10080`을 설정합니다. 단위는 분이며, 10080분은 7일입니다.
또한 transitive dependency가 `github:`, remote tarball, local path 같은 exotic spec을 끌어오는 것을 막기 위해 `blockExoticSubdeps: true`를 명시합니다.

예외가 필요할 때는 broad allowlist를 추가하지 않습니다. 긴급 보안 패치처럼 7일 대기를 건너뛰어야 하는 경우, 버전과 근거를 PR 본문에 남기고 `minimumReleaseAgeExclude`는 package name 단위의 좁은 예외로만 추가합니다. 예외를 추가하면 `scripts/dependency-policy.test.mjs`도 함께 갱신해야 합니다.

## Release Authentication

- `main` 릴리스 파이프라인은 npm Trusted Publishing(GitHub OIDC)을 사용합니다.
- 장기 `NPM_TOKEN` publish 비밀값에 의존하지 않으며, GitHub Actions의 `id-token: write` 권한이 필요합니다.
- npm provenance 검증을 통과하려면 각 공개 패키지의 `package.json`에 있는 `repository.url`이 GitHub repository(`https://github.com/songforthemute/lunatest`)와 일치해야 합니다.
- `pnpm pack:check-integrity`는 publish 전에 tarball 내부 `package.json`의 repository metadata와 `main`/`types`/`exports`/`bin` manifest target 존재를 검증합니다. 새 공개 패키지를 추가할 때는 `scripts/package-roster.mjs`와 package manifest를 함께 갱신해야 합니다.
- release workflow는 Changesets가 version PR을 만드는 단계(`hasChangesets == 'true'`)에서는 npm smoke를 건너뜁니다. version PR merge 후 실제 publish 경로에서는 `pnpm consumer-smoke:npm -- --tag=latest`와 `pnpm consumer-smoke:npm:next`를 실행해 npm registry 소비 경로를 검증합니다. npm smoke도 React 18/19 peer 조합을 순회하지만, 새로 publish된 LunaTest package 자체가 7일 publish-age gate에 막히지 않도록 임시 npm consumer에는 workspace `minimumReleaseAge` 정책을 적용하지 않습니다.

## Maintenance Rules

- 새 root script를 추가하면 README와 이 CI guide의 command list를 함께 갱신합니다.
- 공개 패키지를 추가하거나 release channel을 바꾸면 `scripts/package-roster.mjs`를 먼저 갱신하고 pack/npm smoke와 metadata test가 같은 roster를 보게 합니다.
- public export surface를 바꾸면 EN/KO API reference를 같이 갱신합니다.
- example README에는 machine-local absolute path를 쓰지 않고 repo-relative path만 사용합니다.
