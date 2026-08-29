# 빠른 시작

## 기존 앱에서 LunaTest 사용하기

```bash
pnpm add @lunatest/core @lunatest/react @lunatest/mcp
pnpm add @lunatest/runtime-intercept
pnpm add -D @lunatest/cli @lunatest/vitest-plugin @lunatest/playwright-plugin
```

Vitest와 Playwright 연동을 포함한 모든 공개 LunaTest 패키지는 `latest` 채널로 배포됩니다.

scenario 명령은 저장소 build 산출물이 아니라 설치된 공개 CLI로 실행합니다.

아래 명령을 실행하기 전에 `lunatest.lua`와 하나 이상의 Lua scenario source를
만드세요. [CLI 워크플로](./guides/cli-workflow.md)에서 프로젝트 설정을,
[scenario 작성](./guides/writing-scenarios.md)에서 source 작성 방법을 확인할 수 있습니다.

```bash
pnpm exec lunatest validate
pnpm exec lunatest run
```

실행 가능한 라이브러리 예시는 [라이브러리 소비자 가이드](./guides/library-consumption.md)를 참고하세요.
[CLI 워크플로](./guides/cli-workflow.md)에는 설정과 전체 CLI 명령이 있습니다. RPC endpoint나
지갑 없이 실행하는 예제는 [라이브 데모](./guides/live-demo.md)에서 확인할 수 있습니다.
완성된 앱 예제는 [DeFi Dashboard Dogfood](./guides/defi-dashboard-dogfood.md)와
[Sepolia 스왑 데모 가이드](./guides/swap-demo-sepolia-uniswapv3.md)를 참고하세요.

## 저장소에 기여하기

저장소 CI의 기준 환경은 Node 24와 pnpm 10.33.4입니다. 이는 저장소의 CI/tooling
기준일 뿐, 모든 공개 패키지가 Node 24를 요구한다는 뜻은 아닙니다.

Node 24 설치에 Corepack이 포함되어 있다면 활성화한 뒤 저장소의
`packageManager` 필드가 pnpm 10.33.4를 선택하도록 할 수 있습니다.

```bash
corepack enable
corepack install
```

Corepack을 사용할 수 없거나 환경에 맞지 않으면, 다른 지원 방법으로 같은 pnpm
버전을 설치하세요. 예를 들면 다음과 같습니다.

```bash
npm install --global pnpm@10.33.4
```

저장소 의존성을 설치하고 contributor용 로컬 체크를 실행합니다.

```bash
pnpm install --frozen-lockfile
pnpm -r lint
pnpm run build
pnpm -r test
pnpm test:e2e:smoke
```

위 명령은 로컬 개발용입니다. `pnpm test:e2e:smoke`는 빌드된 workspace package entry를 읽으므로 workspace build writer를 직렬화하는 `pnpm run build`를 먼저 실행해야 합니다. 확장 시나리오가 필요하면 `pnpm test:e2e:extended`를 로컬에서 실행합니다.

### 로컬 성능 체크 실행

성능을 로컬에서 조사할 때는 workspace를 먼저 빌드한 뒤 runner를 직접 실행합니다.

```bash
pnpm run build
node scripts/check-performance.mjs --mode=regression --baseline=scripts/perf-baseline.json --output=scripts/perf-current.json
node scripts/check-performance.mjs --mode=absolute --output=scripts/perf-current-absolute.json
```

회귀 모드는 p95가 저장소 baseline의 110%를 초과하면 실패합니다. 절대 모드는 고정 기준을 사용합니다. p95는 `1ms` 미만이어야 하고, 1,000개 scenario는 `1000ms` 미만에 끝나야 합니다. runner는 실패 전에 한 번 재시도하며, 설정 가능한 `--threshold` 옵션은 지원하지 않습니다.

### Fresh-Checkout CI 재현

`*:ci` script는 CI 계약입니다. workspace `dist` 산출물이 없는 fresh checkout에서 필요한 build를 중앙화합니다. 일반 로컬 반복에서는 사용하지 말고 CI job을 재현할 때만 실행합니다.

```bash
pnpm lint:workspace-types
pnpm run build:workspace:ci
pnpm run lint:workspace:ci
pnpm run test:workspace:ci
pnpm lint:deadcode
pnpm pack:check-integrity
pnpm run test:e2e:smoke:ci
pnpm run perf:regression:ci
```

필요할 때 수동으로 실행하는 Benchmark workflow에서는 아래 명령도 실행합니다.

```bash
pnpm run test:e2e:extended:ci
pnpm run perf:absolute:ci
```

`lint:workspace-types`는 lint 전에 package `dist` 디렉터리를 임시로 제거합니다. `consumer-smoke:pack`은 별도의 packed tarball 소비 검증이며, Linux, Windows, macOS의 각 CI job에서 `pnpm run build:workspace:ci` 다음에 실행됩니다. 배포 후 registry 소비를 검증할 때만 `pnpm consumer-smoke:npm`을 사용합니다.

전체 job 의존성, 플랫폼 조건, 릴리스 정책은 [CI 통합](./guides/ci-integration.md)을 참고하세요.

### 문서 사이트 빌드

```bash
pnpm docs:dev
pnpm docs:build
```
