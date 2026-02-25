# PRD Compliance Evidence (2026-02-25)

## Scope

- 대상 문서: `docs/PRD.md`
- 검증 기준:
  - 산출물 경로 존재 여부
  - 모노레포 정적/빌드/테스트 게이트 통과 여부
  - 성능 게이트 통과 여부
  - 행동 요건(실제 동작) 충족 여부

## Verification Evidence

### 1) Quality Gates

실행 명령:

```bash
pnpm -r lint
pnpm -r build
pnpm -r test
```

결과 요약:

- lint: pass
- build: pass
- test: pass
- workspace test totals:
  - `@lunatest/core`: 43 tests pass
  - `@lunatest/mcp`: 8 tests pass
  - `@lunatest/cli`: 6 tests pass
  - `@lunatest/react`: 3 tests pass
  - `@lunatest/vitest-plugin`: 2 tests pass
  - `@lunatest/playwright-plugin`: 2 tests pass

### 2) Performance Gates

실행 명령:

```bash
node scripts/check-performance.mjs --mode=regression --baseline=scripts/perf-baseline.json --output=scripts/perf-current.json
node scripts/check-performance.mjs --mode=absolute --threshold=5
```

결과:

- regression: `p95Ms=0.0027`, `totalMs1000=1.6689`
- absolute: `p95Ms=0.0038`, `totalMs1000=1.9468`
- 판정: pass

### 3) PRD Explicit Artifact Path Check

PRD의 세션별 구현 범위에 명시된 핵심 경로(런타임/모크/시나리오/러너/CLI/Provider/React/MCP/tools/resources/prompts/generation/plugins/examples/docs/workflows)를 점검.

결과:

- `OK`: 65
- `MISS`: 0

## Requirement-by-Requirement Status

### Phase 1

- Runtime/Determinism/Sandbox/Runner/Reporter/CLI 경로 존재: 충족
- 품질 게이트(lint/build/test): 충족
- 성능 게이트: 충족

판정: **충족**

### Phase 2

- EIP-1193 Provider + React adapters + example apps/scenarios 경로 존재: 충족
- 이벤트 인터페이스/기본 요청 라우팅 테스트 존재: 충족

판정: **충족(코드/테스트 기준)**

### Phase 3

- MCP tools(14), resources(6), prompts(4) 구현 경로 존재: 충족
- generation 모듈(`mutator`, `combinatorial`) 및 흐름 테스트 파일 존재: 충족

판정: **충족(구조/테스트 기준)**

### Phase 4

- protocol presets 4종(V2/V3/Curve/Aave): 충족
- Vitest/Playwright plugin 패키지 및 테스트: 충족
- docs 사이트 구조 파일: 충족
- CI/release/benchmark workflow + changesets config: 충족

판정: **부분 충족(행동 요건 일부 미완료)**

## Behavioral Gaps (중요)

아래는 경로/빌드 통과와 별개로, PRD의 “행동 수준” 기준에서 미완료로 분류한 항목입니다.

1. Vitest plugin 실동작 통합
- 현재 상태: `createLunaVitestPlugin`은 메타 정보 제공 중심이며, Vitest 실행 파이프라인에 scenario 실행을 자동 주입하는 훅 수준 통합은 제한적.
- 영향: "describe/it 스타일로 LunaTest 시나리오 실행"의 완전 자동화 수준 미달.

2. Playwright plugin 자동 주입
- 현재 상태: fixture/commands API는 제공되나, 실제 브라우저 컨텍스트 주입/네트워크 라우팅과 연결된 E2E 통합은 최소 구현.
- 영향: "E2E 테스트에서 LunaProvider 자동 주입"을 완전 보장하지 않음.

3. Documentation site build/deploy
- 현재 상태: 문서 콘텐츠 트리는 채워졌으나, VitePress(또는 동등) 빌드/배포 파이프라인은 미구성.
- 영향: "문서 사이트 빌드 + 배포" 요건 미충족.

4. MCP E2E 실행 체인의 CI 연동
- 현재 상태: `e2e-tests/mcp-flow.test.ts` 파일은 존재하지만 workspace test 파이프라인에 연결되지 않음.
- 영향: PRD의 end-to-end 워크플로우 검증 신뢰도 저하.

## Conscious Debt Register

### Debt A: Plugin Integration Depth

- 포기한 것: Vitest/Playwright 깊은 런타임 통합(실행 훅/주입 자동화 완성도)
- 지금 감당 가능한 이유: 인터페이스/패키지 계약을 먼저 안정화했고, 기존 코어 게이트는 통과 상태
- 회수 시점: 다음 배치에서 plugin integration 테스트를 “실 브라우저 + 실제 scenario 실행”으로 승격할 때

### Debt B: Docs Delivery Pipeline

- 포기한 것: docs generator/build/deploy 자동화
- 지금 감당 가능한 이유: 문서 구조와 핵심 콘텐츠를 선반영해 지식 손실을 방지
- 회수 시점: docs toolchain(VitePress) 선택 직후 CI에 docs build job을 추가할 때

### Debt C: MCP End-to-End Gate Coupling

- 포기한 것: e2e mcp flow의 workspace/CI 필수 게이트화
- 지금 감당 가능한 이유: 모듈 단위 테스트로 핵심 로직 커버 확보
- 회수 시점: e2e-tests를 별도 패키지로 올리고 `pnpm -r test` 또는 CI matrix에 포함할 때

## Final Assessment

- PRD 충족도(산출물/구조 기준): **높음 (명시 경로 누락 0)**
- PRD 충족도(행동/운영 기준): **중간~높음 (주요 4개 갭 존재)**
- 권장 결론: 현재 브랜치는 “구현 골격 + 검증 게이트” 단계로는 병합 가능하나,
  product-grade 선언 전에는 Behavioral Gaps 1~4 해소가 필요.
