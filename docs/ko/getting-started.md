# 빠른 시작

## 1) 설치

```bash
pnpm install --frozen-lockfile
```

## 2) 기본 품질 게이트 실행

```bash
pnpm lint:workspace-types
pnpm -r build
pnpm -r lint
pnpm -r test
```

`pnpm lint:workspace-types`는 workspace 패키지 타입체크가 prebuilt `dist` 산출물에 의존하지 않는지 확인합니다.

## 3) E2E 게이트 실행

PR 스모크 게이트:

```bash
pnpm test:e2e:smoke
```

야간 확장 게이트:

```bash
pnpm test:e2e:extended
```

## 4) 문서 확인

```bash
pnpm docs:dev
```

정적 빌드 확인:

```bash
pnpm docs:build
```

## 5) 성능 게이트 실행

회귀 기준 비교:

```bash
node scripts/check-performance.mjs --mode=regression --baseline=scripts/perf-baseline.json --output=scripts/perf-current.json
```

절대 기준 검증:

```bash
node scripts/check-performance.mjs --mode=absolute --threshold=5 --output=scripts/perf-current-absolute.json
```

## 다음 단계

- 라이브러리 소비자 관점 사용법: [라이브러리 소비자 가이드](./guides/library-consumption.md)
- 실지갑 + 카오스 루프 샘플: [Sepolia 스왑 데모](./guides/swap-demo-sepolia-uniswapv3.md)
- 팀 전용 preset 작성: [Local Preset 작성 가이드](./guides/local-preset-authoring.md)
- 실제 테스트 패턴: [시나리오 예제 모음](./guides/scenario-examples.md)
- 처음부터 끝까지 실행 흐름: [E2E 0→1 워크스루](./guides/e2e-0to1.md)
