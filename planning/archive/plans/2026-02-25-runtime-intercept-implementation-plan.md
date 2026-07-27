# Runtime Intercept Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `@lunatest/runtime-intercept` 패키지를 추가해, `lunatest.lua` + 앱 엔트리 1줄 부트스트랩 기반 개발 런타임 인터셉트(ethereum/fetch/xhr/websocket)를 안정적으로 제공한다.

**Architecture:** 프레임워크 비종속 패키지로 인터셉트 엔진을 분리하고, `enable?: boolean` 우선 로직과 `NODE_ENV` 가드를 통해 개발 환경에서만 안전하게 활성화한다. 라우팅 엔진은 strict/permissive 정책을 공통으로 사용하고, WebSocket은 프레임 레벨 매칭 + HMR bypass를 기본값으로 제공한다.

**Tech Stack:** `TypeScript`, `Vitest`, `pnpm workspace`, Browser runtime APIs (`fetch`, `XMLHttpRequest`, `WebSocket`)

---

## Execution Guardrails

- 적용 스킬: `@test-driven-development`, `@systematic-debugging`, `@verification-before-completion`
- 구현 원칙: DRY, YAGNI, TDD, 작은 단위 커밋
- 활성화 정책: `config.enable` 명시 우선, 미명시 시 `NODE_ENV === "development"`
- 기본 모드: `strict`
- 기본 로그: `debug=false`

### Task 1: Package Scaffold and Public Types

**Files:**
- Create: `packages/runtime-intercept/package.json`
- Create: `packages/runtime-intercept/tsconfig.json`
- Create: `packages/runtime-intercept/src/index.ts`
- Create: `packages/runtime-intercept/src/types.ts`
- Modify: `docs/api/core.md` (패키지 레퍼런스 링크)

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import type { LunaRuntimeInterceptConfig } from "../src/types";

describe("runtime-intercept types", () => {
  it("exposes config type", () => {
    const config: LunaRuntimeInterceptConfig = { intercept: {} };
    expect(config).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @lunatest/runtime-intercept test`
Expected: FAIL (패키지/테스트/타입 미존재)

**Step 3: Write minimal implementation**

- 패키지 스캐폴드 생성
- `LunaRuntimeInterceptConfig` 타입 선언
- `index.ts`에서 타입/export 준비

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @lunatest/runtime-intercept test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/runtime-intercept docs/api/core.md
git commit -m "feat(runtime-intercept): 패키지 스캐폴드와 설정 타입 추가"
```

### Task 2: Activation Gate and Lifecycle Manager

**Files:**
- Create: `packages/runtime-intercept/src/runtime.ts`
- Create: `packages/runtime-intercept/src/state.ts`
- Create: `packages/runtime-intercept/src/__tests__/activation.test.ts`
- Modify: `packages/runtime-intercept/src/index.ts`

**Step 1: Write the failing test**

```ts
it("prefers config.enable over NODE_ENV", () => {
  expect(resolveEnabled({ enable: false }, "development")).toBe(false);
  expect(resolveEnabled({ enable: true }, "production")).toBe(true);
  expect(resolveEnabled({}, "development")).toBe(true);
  expect(resolveEnabled({}, "production")).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @lunatest/runtime-intercept test activation`
Expected: FAIL (`resolveEnabled` 미구현)

**Step 3: Write minimal implementation**

- `resolveEnabled(config, nodeEnv)` 구현
- `enableLunaRuntimeIntercept`/`disableLunaRuntimeIntercept` 기본 lifecycle 구현
- 중복 enable idempotent 처리

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @lunatest/runtime-intercept test activation`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/runtime-intercept/src/runtime.ts packages/runtime-intercept/src/state.ts packages/runtime-intercept/src/__tests__/activation.test.ts packages/runtime-intercept/src/index.ts
git commit -m "feat(runtime-intercept): 활성화 우선순위와 라이프사이클 매니저 추가"
```

### Task 3: Ethereum Interceptor

**Files:**
- Create: `packages/runtime-intercept/src/interceptors/ethereum.ts`
- Create: `packages/runtime-intercept/src/__tests__/ethereum.test.ts`
- Modify: `packages/runtime-intercept/src/runtime.ts`

**Step 1: Write the failing test**

```ts
it("injects ethereum and restores on disable", async () => {
  const restore = installEthereumInterceptor();
  expect((window as any).ethereum?.isLunaTest).toBe(true);
  restore();
  expect((window as any).ethereum?.isLunaTest).not.toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @lunatest/runtime-intercept test ethereum`
Expected: FAIL (인터셉터 미구현)

**Step 3: Write minimal implementation**

- `window.ethereum` 주입
- `request/on/removeListener` 최소 구현
- restore 함수에서 원본 복원

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @lunatest/runtime-intercept test ethereum`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/runtime-intercept/src/interceptors/ethereum.ts packages/runtime-intercept/src/__tests__/ethereum.test.ts packages/runtime-intercept/src/runtime.ts
git commit -m "feat(runtime-intercept): ethereum 인터셉터와 복원 로직 구현"
```

### Task 4: Fetch/XHR Routing Engine (strict/permissive)

**Files:**
- Create: `packages/runtime-intercept/src/interceptors/fetch.ts`
- Create: `packages/runtime-intercept/src/interceptors/xhr.ts`
- Create: `packages/runtime-intercept/src/matcher.ts`
- Create: `packages/runtime-intercept/src/__tests__/network-routing.test.ts`
- Modify: `packages/runtime-intercept/src/runtime.ts`

**Step 1: Write the failing test**

```ts
it("blocks unmatched request in strict mode", async () => {
  const intercept = createFetchInterceptor({ mode: "strict", httpEndpoints: [] }, {});
  await expect(intercept.fetch("https://api.unknown.local")).rejects.toThrow();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @lunatest/runtime-intercept test network-routing`
Expected: FAIL

**Step 3: Write minimal implementation**

- endpoint 패턴 매칭
- `mockResponses[responseKey]` 응답 생성
- strict/permissive 분기 처리
- XHR 인터셉트 동일 정책 적용

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @lunatest/runtime-intercept test network-routing`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/runtime-intercept/src/interceptors/fetch.ts packages/runtime-intercept/src/interceptors/xhr.ts packages/runtime-intercept/src/matcher.ts packages/runtime-intercept/src/__tests__/network-routing.test.ts packages/runtime-intercept/src/runtime.ts
git commit -m "feat(runtime-intercept): fetch/xhr 라우팅 엔진과 strict/permissive 구현"
```

### Task 5: WebSocket Frame-level Interceptor + HMR Bypass

**Files:**
- Create: `packages/runtime-intercept/src/interceptors/websocket.ts`
- Create: `packages/runtime-intercept/src/__tests__/websocket.test.ts`
- Modify: `packages/runtime-intercept/src/types.ts`
- Modify: `packages/runtime-intercept/src/runtime.ts`

**Step 1: Write the failing test**

```ts
it("dispatches scripted frame response on send", () => {
  const ws = createInterceptedWebSocket("wss://stream.local/socket", config);
  const received: unknown[] = [];
  ws.addEventListener("message", (e) => received.push(e.data));
  ws.send(JSON.stringify({ type: "SUBSCRIBE_QUOTE" }));
  expect(received.length).toBe(1);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @lunatest/runtime-intercept test websocket`
Expected: FAIL

**Step 3: Write minimal implementation**

- `WebSocket` 생성자 래핑
- `wsEndpoints` URL 매칭
- `send(frame)` payload 매칭 -> scripted `message` 디스패치
- 기본 HMR bypass 패턴 적용 (`vite-hmr`, `webpack-hmr`, `next-hmr`)
- strict/permissive 분기

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @lunatest/runtime-intercept test websocket`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/runtime-intercept/src/interceptors/websocket.ts packages/runtime-intercept/src/__tests__/websocket.test.ts packages/runtime-intercept/src/types.ts packages/runtime-intercept/src/runtime.ts
git commit -m "feat(runtime-intercept): websocket 프레임 인터셉트와 HMR bypass 구현"
```

### Task 6: Debug Logging and Error Semantics

**Files:**
- Create: `packages/runtime-intercept/src/logger.ts`
- Create: `packages/runtime-intercept/src/__tests__/logger.test.ts`
- Modify: `packages/runtime-intercept/src/interceptors/fetch.ts`
- Modify: `packages/runtime-intercept/src/interceptors/websocket.ts`
- Modify: `packages/runtime-intercept/src/runtime.ts`

**Step 1: Write the failing test**

```ts
it("does not log when debug is false", () => {
  const logs: string[] = [];
  const logger = createLogger(false, (line) => logs.push(line));
  logger.debug("hit");
  expect(logs).toHaveLength(0);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @lunatest/runtime-intercept test logger`
Expected: FAIL

**Step 3: Write minimal implementation**

- `debug` 플래그 기반 로거
- hit/miss/bypass/blocked 이벤트 표준 메시지
- strict 차단 시 에러 메시지 표준화

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @lunatest/runtime-intercept test logger`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/runtime-intercept/src/logger.ts packages/runtime-intercept/src/__tests__/logger.test.ts packages/runtime-intercept/src/interceptors/fetch.ts packages/runtime-intercept/src/interceptors/websocket.ts packages/runtime-intercept/src/runtime.ts
git commit -m "feat(runtime-intercept): 디버그 로깅과 차단 에러 시맨틱 정리"
```

### Task 7: Docs and 0→1 Consumer Example Update

**Files:**
- Modify: `docs/ko/guides/e2e-0to1.md`
- Modify: `docs/ko/guides/library-consumption.md`
- Modify: `docs/guides/library-consumption.md`
- Modify: `README.ko.md`
- Modify: `README.md`
- Modify: `docs/ko/index.md`

**Step 1: Write the failing test (doc smoke)**

```bash
pnpm docs:build
# expected initially: 링크/설명 불일치 발견 가능
```

**Step 2: Run test to verify it fails**

Run: `pnpm docs:build`
Expected: FAIL or manual review mismatch

**Step 3: Write minimal implementation**

- 설치 사용자 기준 `lunatest.lua` + `main.tsx` 1줄 부트스트랩 패턴 문서화
- strict/permissive, WS frame 예시 포함
- 기대 출력과 해석 가이드 보강

**Step 4: Run test to verify it passes**

Run: `pnpm docs:build`
Expected: PASS

**Step 5: Commit**

```bash
git add docs/ko/guides/e2e-0to1.md docs/ko/guides/library-consumption.md docs/guides/library-consumption.md README.ko.md README.md docs/ko/index.md
git commit -m "docs(runtime-intercept): 설치 사용자 관점 가이드 보강"
```

### Task 8: End-to-End Verification and Integration Commit

**Files:**
- Modify: `docs/plans/2026-02-25-prd-compliance-evidence.md`
- Optional: `e2e-tests/playwright-routing.smoke.test.ts` (runtime-intercept example coverage)

**Step 1: Write the failing verification checklist**

```bash
pnpm --filter @lunatest/runtime-intercept lint
pnpm --filter @lunatest/runtime-intercept test
pnpm --filter @lunatest/runtime-intercept build
pnpm docs:build
pnpm test:e2e:smoke
```

**Step 2: Run verification to identify failures**

Expected: 초기 통합 시 일부 실패 가능

**Step 3: Write minimal fixes**

- 타입/빌드 누락 보완
- 문서 링크/예제 드리프트 보정

**Step 4: Re-run full verification**

Run:

```bash
pnpm --filter @lunatest/runtime-intercept lint
pnpm --filter @lunatest/runtime-intercept test
pnpm --filter @lunatest/runtime-intercept build
pnpm docs:build
pnpm test:e2e:smoke
pnpm -r build
pnpm -r lint
pnpm -r test
```

Expected: PASS

**Step 5: Commit**

```bash
git add packages/runtime-intercept docs/plans/2026-02-25-prd-compliance-evidence.md e2e-tests/playwright-routing.smoke.test.ts
git commit -m "feat(runtime-intercept): 런타임 인터셉트 모드 통합 완료"
```
