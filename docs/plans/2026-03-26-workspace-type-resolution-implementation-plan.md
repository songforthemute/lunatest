# Workspace Type Resolution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** fresh checkout에서도 `pnpm -r lint`가 `dist` 산출물 없이 안정적으로 통과하도록, workspace 내부 TypeScript type resolution을 source-first로 정렬한다.

**Architecture:** publish contract는 계속 `dist` 기반으로 유지하고, repo 내부 `tsc`만 `tsconfig paths + project references`를 통해 workspace source entry를 해석하게 만든다. 회귀 방지를 위해 “dist 없는 상태에서 lint가 통과한다”는 검증 경로도 추가한다.

**Tech Stack:** `TypeScript`, `pnpm workspace`, `tsconfig paths`, `project references`, `Vitest`, Node scripts

---

## Execution Guardrails

- 적용 스킬: `@test-driven-development`, `@systematic-debugging`, `@verification-before-completion`
- 구현 범위는 타입 해석과 검증 체계에 한정
- publish/runtime `exports`는 바꾸지 않음
- 공개 entrypoint만 `paths`에 매핑
- 각 task는 작은 단위로 검증 후 진행

### Task 1: Reproduce fresh-checkout failure as an automated regression

**Files:**
- Create: `scripts/check-workspace-type-resolution.mjs`
- Modify: `package.json`
- Test: run script directly in temp workspace

**Step 1: Write the failing regression script**

구현 의도:
- temp directory에 workspace를 복사
- `packages/*/dist`를 제거
- temp workspace에서 `pnpm -r lint` 또는 최소 affected lint를 실행
- 현재 main 기준으로는 실패해야 함

**Step 2: Run script to verify it fails before the fix**

Run:

```bash
node scripts/check-workspace-type-resolution.mjs
```

Expected:
- FAIL
- `Cannot find module '@lunatest/contracts'` 류 에러 재현

**Step 3: Add package.json script**

```json
"lint:workspace-types": "node scripts/check-workspace-type-resolution.mjs"
```

**Step 4: Re-run to confirm the failure is deterministic**

Run:

```bash
pnpm lint:workspace-types
```

Expected:
- same FAIL

**Step 5: Commit**

```bash
git add package.json scripts/check-workspace-type-resolution.mjs
git commit -m "test(workspace): fresh checkout 타입 해석 회귀 재현 추가"
```

### Task 2: Add workspace source entry path aliases

**Files:**
- Modify: `tsconfig.base.json`

**Step 1: Write the minimal paths map**

추가 대상:
- `@lunatest/contracts`
- `@lunatest/core`
- `@lunatest/core/browser`
- `@lunatest/runtime-intercept`
- `@lunatest/react`
- `@lunatest/react/browser`
- `@lunatest/mcp`
- `@lunatest/vitest-plugin`
- `@lunatest/playwright-plugin`
- 필요 시 `@lunatest/cli`

형태:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@lunatest/contracts": ["packages/contracts/src/index.ts"]
    }
  }
}
```

**Step 2: Run targeted package lint before references**

Run:

```bash
pnpm --filter @lunatest/playwright-plugin lint
pnpm --filter @lunatest/core lint
pnpm --filter @lunatest/mcp lint
```

Expected:
- `Cannot find module '@lunatest/contracts'` 계열이 사라짐
- 남는 타입 오류가 있다면 실제 source-level narrowing 문제만 남음

**Step 3: Fix only path-resolution fallout if any**

- 경로 해석 차이로 생기는 타입 오류만 최소 수정
- deep import는 추가하지 않음

**Step 4: Re-run targeted lint**

Expected:
- targeted lint PASS

**Step 5: Commit**

```bash
git add tsconfig.base.json
git commit -m "build(types): workspace source path alias 추가"
```

### Task 3: Add package project references and composite configs

**Files:**
- Modify: `packages/contracts/tsconfig.json`
- Modify: `packages/core/tsconfig.json`
- Modify: `packages/runtime-intercept/tsconfig.json`
- Modify: `packages/react/tsconfig.json`
- Modify: `packages/mcp/tsconfig.json`
- Modify: `packages/playwright-plugin/tsconfig.json`
- Modify: `packages/vitest-plugin/tsconfig.json`
- Modify: `packages/cli/tsconfig.json`

**Step 1: Add `composite: true` where needed**

목표:
- package별로 reference target이 될 수 있는 상태로 맞춤

**Step 2: Add minimal `references`**

예:
- core -> contracts
- runtime-intercept -> contracts
- react -> core, runtime-intercept
- mcp -> contracts, core
- playwright-plugin -> contracts
- cli -> contracts, core, mcp

**Step 3: Run package builds/lints**

Run:

```bash
pnpm --filter @lunatest/contracts build
pnpm --filter @lunatest/core build
pnpm --filter @lunatest/runtime-intercept build
pnpm --filter @lunatest/react build
pnpm --filter @lunatest/mcp build
pnpm --filter @lunatest/playwright-plugin build
pnpm --filter @lunatest/cli build
```

Expected:
- PASS

**Step 4: Run regression script again**

Run:

```bash
pnpm lint:workspace-types
```

Expected:
- 이제 PASS

**Step 5: Commit**

```bash
git add packages/*/tsconfig.json
git commit -m "build(types): package references와 composite 구성 추가"
```

### Task 4: Add solution config for workspace verification

**Files:**
- Create: `tsconfig.workspace.json`

**Step 1: Create solution config**

내용:
- package references를 모아둔 root solution tsconfig

**Step 2: Run build-mode type verification**

Run:

```bash
pnpm exec tsc -b tsconfig.workspace.json --pretty false
```

Expected:
- PASS

**Step 3: Optional no-emit verify**

가능하면 script나 CI에서 solution config도 사용

**Step 4: Commit**

```bash
git add tsconfig.workspace.json
git commit -m "build(types): workspace solution tsconfig 추가"
```

### Task 5: Sync CI and docs with the new invariant

**Files:**
- Modify: `.github/workflows/release.yml`
- Modify: `.github/workflows/ci.yml`
- Modify: `docs/guides/ci-integration.md`
- Modify: `README.md`

**Step 1: Add fresh-checkout-safe lint proof to CI**

권장:
- 기존 `pnpm -r lint` 유지
- 추가로 `pnpm lint:workspace-types` 또는 solution verify 추가

**Step 2: Document the invariant**

문서화 내용:
- internal workspace typecheck no longer depends on `dist`
- publish artifact는 여전히 `dist` 기반
- 로컬/CI에서 어떤 검증이 이를 보장하는지 설명

**Step 3: Run docs and CI-equivalent checks**

Run:

```bash
pnpm docs:build
pnpm lint:workspace-types
```

Expected:
- PASS

**Step 4: Commit**

```bash
git add .github/workflows docs README.md
git commit -m "ci(types): fresh checkout 타입 해석 검증 추가"
```

### Task 6: Full verification and release dry-run

**Files:**
- No new files

**Step 1: Run the full gate**

Run:

```bash
pnpm -r lint
pnpm -r build
pnpm -r test
pnpm docs:build
pnpm pack:check-integrity
pnpm consumer-smoke:pack
CI=1 pnpm changeset status --output=./.changeset-status.json
pnpm release:publish:dry-run
```

Expected:
- all PASS

**Step 2: Explicitly re-run the fresh-checkout regression proof**

Run:

```bash
pnpm lint:workspace-types
```

Expected:
- PASS

**Step 3: Summarize the before/after invariant**

검증해야 할 말:
- before: `lint` required prebuilt `dist`
- after: `lint` is artifact-independent in workspace

**Step 4: Final commit**

```bash
git add -A
git commit -m "fix(build): fresh checkout 타입 해석 의존성 제거"
```
