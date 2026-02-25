# E2E 0→1 워크스루

이 문서는 "처음 붙여보는 사람" 기준으로 작성했습니다.
핵심은 세 가지입니다.

1. 이렇게 작성한다.
2. 이렇게 실행한다.
3. 결과는 이렇게 읽는다.

아래 흐름을 끝까지 따라가면 `MCP -> Playwright 라우팅 -> CLI`까지 한 번에 감을 잡을 수 있습니다.

## 0) 준비

```bash
pnpm install --frozen-lockfile
pnpm -r build
```

## 1) 가장 빠른 전체 확인: 스모크 E2E 실행

```bash
pnpm test:e2e:smoke
```

기대 출력(요약):

```text
✓ cli-gen.smoke.test.ts (1 test)
✓ playwright-routing.smoke.test.ts (1 test)
✓ mcp-flow.smoke.test.ts (1 test)

Test Files  3 passed (3)
Tests       3 passed (3)
```

어떻게 보면 되나:

- 세 파일이 모두 `✓`면 기본 E2E 체인은 정상입니다.
- 여기서 하나라도 깨지면, 아래 2~4단계에서 원인을 좁혀 들어가면 됩니다.

## 2) MCP 흐름을 직접 써보기 (create -> run)

아래처럼 테스트를 작성하면 시나리오 생성과 실행 결과를 한 번에 확인할 수 있습니다.

```ts
import { describe, expect, it } from "vitest";
import { createMcpServer } from "@lunatest/mcp";

describe("mcp 0to1", () => {
  it("creates and runs a scenario", async () => {
    const server = createMcpServer({ scenarios: [] });

    const created = await server.handleRequest({
      id: "1",
      method: "scenario.create",
      params: { id: "swap-1", name: "swap happy path" },
    });

    const run = await server.handleRequest({
      id: "2",
      method: "scenario.run",
      params: { id: "swap-1" },
    });

    expect(created).toEqual({
      id: "1",
      result: { id: "swap-1", name: "swap happy path" },
    });

    expect(run).toEqual({
      id: "2",
      result: { id: "swap-1", pass: true },
    });
  });
});
```

핵심 포인트:

- `scenario.create`의 `result.id`가 생성 식별자입니다.
- `scenario.run` 결과에서 `pass: true`면 시나리오 실행이 정상입니다.

## 3) Playwright 라우팅을 직접 써보기 (strict 모드)

아래 예제는 매핑된 RPC 요청은 응답하고, 모르는 요청은 막는 흐름입니다.

```ts
import { describe, expect, it } from "vitest";
import { createLunaFixture } from "@lunatest/playwright-plugin";

describe("playwright routing 0to1", () => {
  it("fulfills known rpc and blocks unknown route", async () => {
    const fixture = createLunaFixture({
      routing: {
        mode: "strict",
        rpcEndpoints: [
          {
            urlPattern: "https://rpc.test",
            methods: ["eth_chainId"],
            responseKey: "chain",
          },
        ],
      },
      mockResponses: {
        chain: { result: "0x1" },
      },
    });

    // installRouting 이후, known RPC는 fulfill / unknown은 abort 되는지 검증
    // (실제 프로젝트에서는 page.route 기반으로 연결)
  });
});
```

결과를 이렇게 읽으면 됩니다:

- known RPC 응답에서 `result: "0x1"`이면 매핑이 정상
- strict 모드에서 unknown 요청이 차단되면 라우팅 누락을 빠르게 발견 가능

## 4) CLI 생성 플로우 확인 (`gen --ai`)

```bash
node packages/cli/dist/index.js gen --ai
```

기대 출력:

```text
AI generation complete
created=1
executed=1
```

결과를 이렇게 읽으면 됩니다:

- `created`는 생성된 시나리오 수
- `executed`는 즉시 검증까지 돌린 수

## 5) “지금 제대로 붙었는지” 최종 체크리스트

- `pnpm test:e2e:smoke`가 3/3 PASS인지
- MCP `scenario.create -> scenario.run`에서 `pass: true`가 나오는지
- Playwright strict 모드에서 unknown 요청이 차단되는지
- CLI `gen --ai` 출력에 `created`, `executed`가 보이는지

이 네 가지가 맞으면 0→1 단계는 통과입니다. 이제부터는 시나리오를 늘리면서 coverage와 확장 E2E로 넘어가면 됩니다.
