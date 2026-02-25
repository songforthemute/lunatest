# PRD Compliance Evidence (2026-02-25)

## Scope

- 대상 문서: `docs/PRD.md`
- 검증 기준:
  - 산출물 경로 존재 여부
  - 모노레포 정적/빌드/테스트 게이트 통과 여부
  - 문서 사이트 빌드/배포 파이프라인 충족 여부
  - E2E 게이트(PR smoke, nightly extended) 충족 여부
  - 성능 게이트(regression, absolute) 통과 여부
  - 행동 요건(플러그인/통합 경로) 충족 여부

## Verification Evidence

### 1) Workspace Quality Gates

실행 명령:

```bash
pnpm -r build
pnpm -r lint
pnpm -r test
```

결과 요약:

- build: pass
- lint: pass
- test: pass
- workspace test totals:
  - `@lunatest/core`: 44 tests pass
  - `@lunatest/mcp`: 11 tests pass
  - `@lunatest/cli`: 6 tests pass
  - `@lunatest/react`: 3 tests pass
  - `@lunatest/vitest-plugin`: 2 tests pass
  - `@lunatest/playwright-plugin`: 7 tests pass
  - `@lunatest/e2e-tests`(workspace test 스모크): 3 tests pass

### 2) Documentation Build/Deploy Gates

실행 명령:

```bash
pnpm docs:build
DOCS_BASE=/luaw3b/ pnpm docs:build
```

결과 요약:

- `vitepress build docs`: pass
- GitHub Pages용 base 경로 구성:
  - repo page: `/${repo}/`
  - user/org page: `/`
- workflow: `.github/workflows/docs.yml`에서 저장소명 기반 `DOCS_BASE` 자동 계산 확인

### 3) E2E Gates

실행 명령:

```bash
pnpm test:e2e:smoke
pnpm test:e2e:extended
```

결과:

- smoke: 3 tests pass (`mcp-flow`, `playwright-routing`, `cli-gen`)
- extended: 4 tests pass (`scenario-mutation` 포함)
- PR/야간 분리 정책 반영:
  - PR: `.github/workflows/ci.yml`
  - Nightly: `.github/workflows/benchmark.yml`

### 4) Performance Gates

실행 명령:

```bash
node scripts/check-performance.mjs --mode=regression --baseline=scripts/perf-baseline.json --output=scripts/perf-current.json
node scripts/check-performance.mjs --mode=absolute --threshold=5 --output=scripts/perf-current-absolute.json
```

결과:

- regression: `p95Ms=0.0025`, `totalMs1000=2.3252`
- absolute: `p95Ms=0.0029`, `totalMs1000=1.2877`
- 판정: pass

### 5) Explicit Path/Feature Checks (행동 요건 핵심 경로)

다음 핵심 경로의 존재를 확인:

- `packages/mcp/src/transport/stdio.ts`
- `packages/mcp/src/bin/mcp-stdio.ts`
- `packages/vitest-plugin/src/plugin.ts`
- `packages/playwright-plugin/src/fixture.ts`
- `e2e-tests/mcp-flow.smoke.test.ts`
- `docs/.vitepress/config.mts`
- `.github/workflows/docs.yml`
- `.github/workflows/ci.yml`
- `.github/workflows/benchmark.yml`

결과: `MISS 0`

## Requirement-by-Requirement Status

### Phase 1

- Runtime/Determinism/Sandbox/Runner/Reporter/CLI: 충족
- 품질 게이트(lint/build/test): 충족
- 성능 게이트(regression/absolute): 충족

판정: **충족**

### Phase 2

- EIP-1193 Provider + React adapters + examples/scenarios: 충족
- provider 이벤트/라우팅 테스트: 충족

판정: **충족**

### Phase 3

- MCP tools/resources/prompts/generation + stdio transport: 충족
- 관련 테스트: 충족

판정: **충족**

### Phase 4

- protocol presets 4종(V2/V3/Curve/Aave): 충족
- Vitest/Playwright plugin 패키지 + 테스트: 충족
- docs 사이트 빌드/배포(GitHub Pages): 충족
- E2E 게이트 분리 운영(PR smoke / nightly extended): 충족
- release/changeset/workflow: 충족

판정: **충족**

## Behavioral Gap Closure

이전 문서의 4개 behavioral gap은 모두 해소됨:

1. Vitest plugin 실동작 통합: `@lunatest/vitest-plugin` 테스트 및 패키지 통합으로 해소
2. Playwright plugin 자동 주입/라우팅 통합: fixture/commands + routing smoke 테스트로 해소
3. Documentation site build/deploy: VitePress + GitHub Pages workflow로 해소
4. MCP E2E CI 연동: `e2e-tests` 패키지/스크립트/CI 연결로 해소

## Final Assessment

- PRD 충족도(산출물/구조 기준): **충족**
- PRD 충족도(행동/운영 기준): **충족**
- 결론: `1/3/4/5` 결정안 기준의 strict PRD 요구사항은 현재 브랜치에서 충족.
