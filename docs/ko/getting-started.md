# 빠른 시작

## 1) 설치

```bash
pnpm install --frozen-lockfile
```

## 2) 로컬 체크 실행

```bash
pnpm lint:workspace-types
pnpm -r lint
pnpm -r build
pnpm -r test
```

`pnpm lint:workspace-types`는 workspace 패키지 타입체크가 prebuilt `dist` 산출물에 의존하지 않는지 확인합니다.

## 3) 릴리스 게이트 실행

```bash
pnpm lint:deadcode
pnpm pack:check-integrity
```

## 4) CLI 실행

`gen --ai`를 사용할 계획이라면 `lunatest.config.json`에 `ai.command`를 정의해야 합니다.

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

`lunatest gen --ai`는 `lunatest.config.json`의 `ai.command`가 있어야 동작합니다. 이 설정이 없으면 시나리오를 생성하지 않고 바로 종료합니다.

## 5) E2E 게이트 실행

PR 스모크 게이트:

```bash
pnpm test:e2e:smoke
```

야간 확장 게이트:

```bash
pnpm test:e2e:extended
```

## 6) 문서 확인

```bash
pnpm docs:dev
```

RPC/지갑 없이 바로 실행되는 문서용 데모는 [라이브 데모](./guides/live-demo.md)에서 확인할 수 있습니다.

정적 빌드 확인:

```bash
pnpm docs:build
```

## 7) 성능 게이트 실행

회귀 기준 비교:

```bash
node scripts/check-performance.mjs --mode=regression --baseline=scripts/perf-baseline.json --output=scripts/perf-current.json
```

절대 기준 검증:

```bash
node scripts/check-performance.mjs --mode=absolute --threshold=5 --output=scripts/perf-current-absolute.json
```

## 8) CI 전용 wrapper

CI/야간 job에서는 E2E나 성능 체크를 직접 호출하지 않고 아래 wrapper를 사용합니다.

```bash
pnpm run build:workspace:ci
pnpm run lint:workspace:ci
pnpm run test:workspace:ci
pnpm run test:e2e:smoke:ci
pnpm run test:e2e:extended:ci
pnpm run perf:regression:ci
pnpm run perf:absolute:ci
```

`test:e2e:*`는 workspace source integration 동작을 검증합니다. 패키지 public entrypoint를 tarball 또는 npm registry 기준으로 검증할 때는 `pnpm consumer-smoke:pack` 또는 `pnpm consumer-smoke:npm`을 사용합니다.

## 다음 단계

- 라이브러리 소비자 관점 사용법: [라이브러리 소비자 가이드](./guides/library-consumption.md)
- 실지갑 + 카오스 루프 샘플: [Sepolia 스왑 데모](./guides/swap-demo-sepolia-uniswapv3.md)
- 팀 전용 preset 작성: [Local Preset 작성 가이드](./guides/local-preset-authoring.md)
- 실제 테스트 패턴: [시나리오 예제 모음](./guides/scenario-examples.md)
- 처음부터 끝까지 실행 흐름: [E2E 0→1 워크스루](./guides/e2e-0to1.md)
