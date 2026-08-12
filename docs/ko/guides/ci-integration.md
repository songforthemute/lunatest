# CI 통합

LunaTest는 빠른 로컬 반복과 fresh checkout CI를 분리합니다. 로컬 명령은 workspace가 이미 빌드되어 있다고 가정합니다. CI job은 각각 새 checkout에서 시작하므로, 저장소는 필요한 package 산출물을 한 곳에서 준비하는 `*:ci` wrapper script를 제공합니다.

## 로컬 명령

일반 개발에서는 직접 명령을 사용합니다.

```sh
pnpm -r lint
pnpm -r build
pnpm -r test
pnpm test:e2e:smoke
pnpm test:e2e:extended
pnpm test:browser
```

직접 E2E 명령은 workspace package entry를 읽으므로 먼저 build가 필요합니다. 로컬에서 성능을 조사할 때도 먼저 빌드한 뒤 runner를 직접 실행합니다.

```sh
pnpm -r build
node scripts/check-performance.mjs --mode=regression --baseline=scripts/perf-baseline.json --output=scripts/perf-current.json
node scripts/check-performance.mjs --mode=absolute --output=scripts/perf-current-absolute.json
```

## Fresh-Checkout CI 계약

CI job을 로컬에서 재현할 때는 다음 명령을 사용합니다. 빠른 로컬 개발 흐름과 의도적으로 분리되어 있습니다.

```sh
pnpm lint:workspace-types
pnpm run build:workspace:ci
pnpm run lint:workspace:ci
pnpm run test:workspace:ci
pnpm lint:deadcode
pnpm pack:check-integrity
pnpm run test:e2e:smoke:ci
pnpm run test:browser:ci
pnpm run perf:regression:ci
```

예약된 Benchmark workflow에서는 아래 명령도 실행합니다.

```sh
pnpm run test:e2e:extended:ci
pnpm run perf:absolute:ci
```

`build:workspace:ci`, `lint:workspace:ci`, `test:workspace:ci`는 root workspace package와 `@lunatest/e2e-tests`를 제외합니다. 이로써 root recursive script가 전체 workspace를 다시 실행하지 않습니다. E2E/성능 CI wrapper는 내부에서 `build:workspace:ci`를 실행합니다. `lint:workspace-types`는 lint 전에 package `dist` 디렉터리를 임시로 옮겨, workspace 타입 해석이 prebuilt 산출물에 의존하지 않음을 검증합니다.

## Pull Request Workflow

`.github/workflows/ci.yml`은 다음 job을 실행합니다.

1. `quality`는 `lint:workspace-types`, CI build/lint/test wrapper, `lint:deadcode`, `pack:check-integrity`를 실행합니다.
2. `consumer-smoke-pack`은 `quality` 후 Linux에서 실행됩니다. Windows와 macOS packed-consumer job은 pull request와 `main`에서 실행됩니다.
3. `e2e-smoke`는 `quality` 후 `pnpm run test:e2e:smoke:ci`를 실행합니다.
4. `browser-scenario`는 `quality` 후 Linux에서 실행되며 Playwright로 Chromium을 설치한 뒤 `pnpm run test:browser:ci`를 호출합니다.
5. `performance-regression`은 pull request와 push에서 `quality`, Linux packed-consumer smoke, E2E smoke 이후 실행됩니다. 이 job은 `pnpm run perf:regression:ci`를 호출합니다.

모든 job은 `pnpm install --frozen-lockfile`로 설치합니다. packed-consumer job은 `pnpm consumer-smoke:pack` 전에 반드시 `pnpm run build:workspace:ci`를 실행합니다.

`test:e2e:*`는 workspace source integration을 검증합니다. `consumer-smoke:pack`은 stable 공개 패키지 전체의 local tarball을 React 18/19 peer 조합에 설치해 public package entrypoint를 검증합니다. 이는 npm registry 소비 검증을 대체하지 않습니다.

`test:browser`는 Chromium scenario contract를 실행합니다. 로컬 실행 전에는 `pnpm --filter @lunatest/e2e-tests exec playwright install chromium`으로 같은 browser binary를 설치하세요. browser 설치는 의도적으로 Linux CI job에만 제한하며 Windows/macOS consumer job은 browser를 설치하지 않습니다.

## 야간 Benchmark Workflow

`.github/workflows/benchmark.yml`은 매일 `00:00 UTC`에 실행되며 수동 실행도 가능합니다. Ubuntu job 두 개로 구성됩니다.

1. `nightly-performance`는 `pnpm run perf:absolute:ci`를 실행하고 `scripts/perf-current-absolute.json`을 artifact로 업로드합니다.
2. `nightly-e2e-extended`는 `pnpm run test:e2e:extended:ci`를 실행합니다.

## 성능 계약

성능 runner는 warm-up 후 200개 scenario로 p95를 측정하고, 1,000개 scenario로 전체 시간을 측정합니다. 검사에 실패하면 실패를 보고하기 전에 한 번 재시도합니다.

- 회귀 모드는 p95가 `scripts/perf-baseline.json`의 110%를 초과하면 실패합니다.
- 절대 모드는 p95가 `>= 1ms`이거나 1,000개 scenario가 `>= 1000ms`이면 실패합니다.

이 기준은 `scripts/check-performance.mjs`에 고정되어 있으며 `--threshold` 옵션은 지원하지 않습니다.

## Packed 및 npm 소비 검증

검증할 artifact에 따라 명령을 구분합니다.

```sh
# Local tarball. CI job을 재현할 때는 CI workspace build 다음에 실행합니다.
pnpm run build:workspace:ci
pnpm consumer-smoke:pack

# 배포 후 npm registry package를 검증합니다.
pnpm consumer-smoke:npm -- --tag=latest
```

Release workflow는 같은 fresh-checkout 품질 계약을 실행한 뒤 packed-consumer smoke를 실행합니다. Changesets publish action이 publish 경로에서 완료되면 `latest` npm smoke를 실행합니다.

## 공급망 설치 정책

`pnpm-workspace.yaml`은 `minimumReleaseAge: 10080`을 설정하여 새 npm 버전이 설치되기 전 7일 동안 대기하게 합니다. `blockExoticSubdeps: true`는 transitive `github:`, remote tarball, local path dependency specification을 차단합니다.

예외를 위해 광범위한 allowlist를 추가하지 마세요. 긴급 보안 패치처럼 age gate를 건너뛰어야 한다면 PR에 버전과 근거를 기록하고 좁은 범위의 `minimumReleaseAgeExclude`만 사용합니다. 이 정책을 변경하면 `scripts/dependency-policy.test.mjs`도 갱신합니다.

## 릴리스 인증

- `main` Release workflow는 GitHub OIDC 기반 npm Trusted Publishing을 사용하며 `id-token: write` 권한이 필요합니다.
- 장기 `NPM_TOKEN` publish secret을 사용하지 않습니다.
- npm provenance를 위해 공개 패키지의 `repository.url`은 `https://github.com/songforthemute/lunatest`와 일치해야 합니다.
- `pnpm pack:check-integrity`는 publish 전에 packed `package.json` metadata와 manifest의 `main`, `types`, `exports`, `bin` target을 검증합니다.

## 문서 및 병합 후 모니터링

Docs workflow는 pull request에서 build하고 `main` push 후에만 deploy합니다. path filter에는 문서 소스, 실행 가능한 swap/DeFi-dashboard example, docs build script, package-lock 입력이 포함됩니다. 배포는 GitHub Pages 활성화 여부를 확인하고 배포된 live demo를 smoke test합니다.

병합 후 merge commit에 대한 workflow가 생성되었는지 확인합니다. automation token이 run을 만들지 않았다면 `main`에서 필요한 workflow를 수동 dispatch합니다.

```sh
gh run list --commit <merge-sha> --limit 20
gh workflow run ci.yml --ref main
gh workflow run docs.yml --ref main
gh workflow run release.yml --ref main
```

수동 dispatch는 현재 `main` 상태를 기준으로 평가합니다. 릴리스 경로를 다시 실행할 의도가 있을 때만 `release.yml`을 수동 실행합니다.

## 유지보수 규칙

- root script를 추가하면 README와 CI 가이드의 명령 목록도 함께 갱신합니다.
- 공개 패키지나 릴리스 채널이 바뀌면 `scripts/package-roster.mjs`, pack/npm smoke 범위, package metadata 검증을 함께 갱신합니다.
- public export surface가 바뀌면 영어/한국어 API reference를 모두 갱신합니다.
- example README에는 저장소 상대 경로만 사용하고 machine-local absolute path를 추가하지 않습니다.
