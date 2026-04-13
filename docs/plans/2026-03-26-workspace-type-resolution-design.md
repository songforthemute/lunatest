# Workspace Type Resolution Design (2026-03-26)

## 배경

현재 monorepo 내부 패키지들은 `@lunatest/*` workspace dependency를 참조할 때,
실질적으로 각 패키지의 `package.json` `types` 엔트리(`./dist/index.d.ts`)를 통해 타입을 해석합니다.

이 구조는 로컬 개발 환경에서는 잘 드러나지 않습니다.
이미 `pnpm -r build`를 여러 번 실행한 상태라 `dist/` 산출물이 남아 있기 때문입니다.

하지만 GitHub Actions의 fresh checkout에서는 `dist/`가 존재하지 않습니다.
그 상태에서 Release workflow가 `lint`를 `build`보다 먼저 실행하면,
TypeScript가 workspace dependency의 타입 선언을 찾지 못해 `Cannot find module '@lunatest/contracts'`
같은 오류로 즉시 실패합니다.

이번 설계의 목표는 `dist` 존재 여부와 무관하게, repo 내부 typecheck가 항상 안정적으로 통과하도록 만드는 것입니다.

## 목표

- fresh checkout에서도 `pnpm -r lint`가 `build`보다 먼저 성공
- published package contract (`main`, `types`, `exports -> dist`)는 유지
- workspace 내부 타입 해석은 `dist`가 아니라 source entry를 우선 사용
- package dependency graph와 TypeScript build graph를 명시적으로 정렬
- Release workflow 순서 변경 없이도 안정적으로 동작

## 비목표

- npm publish artifact 구조 변경
- package import specifier를 deep import로 바꾸는 작업
- monorepo 전체를 단일 tsconfig 하나로 합치는 리팩터
- 런타임 module resolution 변경

## 확인한 사실

1. `@lunatest/playwright-plugin`은 `@lunatest/contracts`를 dependency로 가집니다.
2. TypeScript는 workspace 설치된 `@lunatest/contracts/package.json`의 `types` 필드인 `./dist/index.d.ts`를 따라갑니다.
3. `packages/contracts/dist`가 없으면 `playwright-plugin`, `core`, `mcp` 모두 `tsc --noEmit`에서 같은 방식으로 실패합니다.
4. 따라서 문제의 본질은 특정 패키지 한 개가 아니라, workspace type resolution이 build artifact에 의존한다는 구조 자체입니다.

## 고려한 접근

### 옵션 A. CI 순서만 바꾸기

- `build`를 `lint`보다 먼저 실행
- 장점: 가장 빠른 복구
- 단점: 근본 해결이 아님
- 단점: fresh checkout에서 repo 내부 타입 해석이 여전히 `dist`에 의존
- 결론: 회피책으로는 가능하지만 이번 범위의 답은 아님

### 옵션 B. workspace source mapping + project references

- repo 내부 `tsc`만 `@lunatest/*`를 source entry로 해석
- package publish contract는 그대로 유지
- package `tsconfig`에 `composite`와 `references` 추가
- 장점: fresh checkout-safe
- 장점: current package boundary와 publish 구조를 보존
- 단점: tsconfig 손보는 범위가 넓음
- 결론: 채택

### 옵션 C. package exports에 source 조건 추가

- package.json `exports`에 repo 내부 전용 조건을 더 넣는 방식
- 장점: package manifest 기반으로 보일 수 있음
- 단점: TypeScript/Node/tooling 조건 해석 차이가 커서 유지비용이 큼
- 단점: workspace 전용 해석을 publish contract와 섞게 됨
- 결론: 불채택

## 확정 설계

### 1. workspace source-first type resolution

`tsconfig.base.json`에 `baseUrl`과 `paths`를 추가해,
repo 내부 TypeScript가 `@lunatest/*`를 해석할 때만 source entry를 보게 만듭니다.

예시:

- `@lunatest/contracts` -> `packages/contracts/src/index.ts`
- `@lunatest/core` -> `packages/core/src/index.ts`
- `@lunatest/core/browser` -> `packages/core/src/browser.ts`
- `@lunatest/runtime-intercept` -> `packages/runtime-intercept/src/index.ts`
- `@lunatest/react` -> `packages/react/src/index.ts`
- `@lunatest/react/browser` -> `packages/react/src/browser.ts`
- `@lunatest/mcp` -> `packages/mcp/src/index.ts`
- `@lunatest/vitest-plugin` -> `packages/vitest-plugin/src/index.ts`
- `@lunatest/playwright-plugin` -> `packages/playwright-plugin/src/index.ts`
- `@lunatest/cli`는 외부 package import 대상이 아니므로 필요 시 최소 범위만 추가

중요한 점:
- 공개 entrypoint만 mapping합니다.
- deep internal path는 mapping하지 않습니다.
- published consumer는 계속 package.json `exports`와 `dist`를 사용합니다.

### 2. package-level project references

각 패키지 `tsconfig.json`에 `composite: true`와 `references`를 추가해,
workspace dependency graph와 TypeScript build graph를 맞춥니다.

예시:

- `packages/core` -> `../contracts`
- `packages/runtime-intercept` -> `../contracts`
- `packages/react` -> `../core`, `../runtime-intercept`
- `packages/mcp` -> `../contracts`, `../core`
- `packages/playwright-plugin` -> `../contracts`
- `packages/cli` -> `../contracts`, `../core`, `../mcp`

이 구조는 두 가지 이점을 줍니다.

- 어떤 패키지가 어떤 타입 선언에 의존하는지 명확해짐
- 필요할 경우 `tsc -b` 기반 solution build를 쓸 수 있음

### 3. solution tsconfig 추가

root에 `tsconfig.workspace.json` 같은 solution config를 둡니다.

역할:
- workspace package references를 한 곳에 모음
- fresh checkout type graph를 한 번에 확인할 수 있게 함
- 필요 시 CI나 로컬 regression command에서 사용

이 파일은 publish artifact와 무관하고, monorepo 검증 전용입니다.

### 4. regression proof 추가

이번 문제는 로컬 cache/dist 상태 때문에 쉽게 숨습니다.
그래서 “dist 없이도 lint 가능하다”를 다시 깨뜨리지 않도록, regression proof가 필요합니다.

권장 방식:
- temp workspace에서 `packages/*/dist`를 제거한 상태로
- `pnpm -r lint` 또는 최소 affected package lint를 실행하는 검증 스크립트 추가

예:
- `scripts/check-workspace-type-resolution.mjs`

검증 기준:
- fresh checkout과 같은 조건에서 `lint`가 먼저 돌아도 통과해야 함

## 파일 변경 범위

핵심:
- `tsconfig.base.json`
- `tsconfig.workspace.json` (new)
- `packages/contracts/tsconfig.json`
- `packages/core/tsconfig.json`
- `packages/runtime-intercept/tsconfig.json`
- `packages/react/tsconfig.json`
- `packages/mcp/tsconfig.json`
- `packages/playwright-plugin/tsconfig.json`
- `packages/vitest-plugin/tsconfig.json`
- `packages/cli/tsconfig.json`

필요 시:
- `scripts/check-workspace-type-resolution.mjs` (new)
- `package.json` root script
- `docs/guides/ci-integration.md`

## 리스크

### 리스크 1. repo 내부 해석과 published consumer 해석이 달라질 수 있음

대응:
- 공개 entrypoint만 `paths`에 매핑
- deep import 금지 유지
- `consumer-smoke:pack`를 계속 릴리스 게이트로 유지

### 리스크 2. references 추가로 build graph가 복잡해질 수 있음

대응:
- workspace dependency가 실제로 있는 패키지만 최소한으로 연결
- YAGNI 원칙으로 example/e2e 쪽 references는 필요 시에만 추가

### 리스크 3. 일부 패키지의 `rootDir/include`와 composite가 충돌할 수 있음

대응:
- package별로 현재 `src` 기반 경계를 유지
- declarations/outDir 정책은 그대로 유지

## 완료 기준

아래가 모두 만족되면 이번 문제는 근본적으로 닫힌 것으로 봅니다.

- fresh checkout 조건(또는 동등한 temp 검증)에서 `pnpm -r lint` 통과
- `pnpm -r build` 통과
- `pnpm -r test` 통과
- `pnpm pack:check-integrity` 통과
- `pnpm consumer-smoke:pack` 통과
- Release workflow가 `lint -> build` 순서 그대로여도 성공

## 추천

옵션 B를 권장합니다.

이 방식은 현재 package publish model을 깨지 않으면서도,
workspace 내부 typecheck를 artifact-independent하게 만듭니다.

즉, “CI 순서를 우연히 맞춰서 통과시키는 것”이 아니라
“repo 자체가 fresh checkout에서 정직하게 typecheck되는 구조”로 바꾸는 해법입니다.
