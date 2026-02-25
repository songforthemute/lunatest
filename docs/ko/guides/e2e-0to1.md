# E2E 0→1 워크스루 (라이브러리 설치 사용자용)

이 문서는 "LunaTest를 처음 설치해서 써보는 사용자"를 기준으로 작성했습니다.

읽는 흐름은 단순합니다.

1. 프로젝트를 만든다.
2. 패키지를 설치한다.
3. 테스트 파일을 만든다.
4. 실행 결과를 보고 정상 동작을 확인한다.

## 목표

아래 두 가지가 확인되면 0→1은 성공입니다.

- Playwright 테스트에서 네트워크 모킹이 실제로 동작한다.
- CLI/MCP 명령 실행 결과를 눈으로 확인할 수 있다.

## 0) 새 프로젝트 생성

```bash
pnpm create vite lunatest-hello --template react-ts
cd lunatest-hello
```

## 1) 패키지 설치

```bash
pnpm add @lunatest/core@latest @lunatest/react@latest @lunatest/mcp@latest @lunatest/cli@latest
pnpm add -D @lunatest/playwright-plugin@next @lunatest/vitest-plugin@next @playwright/test vitest
pnpm exec playwright install
```

설치가 끝나면 "core/react/mcp/cli + e2e plugin" 최소 조합이 준비된 상태입니다.

## 2) Playwright E2E 테스트 파일 작성

`tests/luna.e2e.spec.ts` 파일을 만들고 아래 내용을 넣습니다.

```ts
import { test, expect } from "@playwright/test";
import { createLunaFixture } from "@lunatest/playwright-plugin";

test("0to1: quote api is mocked", async ({ page }) => {
  const luna = createLunaFixture({
    routing: {
      mode: "strict",
      httpEndpoints: [
        {
          urlPattern: "https://api.luna.local/quote",
          method: "GET",
          responseKey: "quote",
        },
      ],
    },
    mockResponses: {
      quote: {
        status: 200,
        headers: {
          "access-control-allow-origin": "*",
        },
        body: {
          amountOut: "123.45",
          priceImpactBps: 12,
        },
      },
    },
  });

  await luna.injectProvider(page);
  await luna.installRouting(page);

  await page.goto("https://example.com");

  const quote = await page.evaluate(async () => {
    const response = await fetch("https://api.luna.local/quote", {
      method: "GET",
    });
    return response.json();
  });

  expect(quote).toEqual({
    amountOut: "123.45",
    priceImpactBps: 12,
  });
});
```

## 3) E2E 실행

```bash
pnpm exec playwright test tests/luna.e2e.spec.ts
```

기대 출력(요약):

```text
Running 1 test using 1 worker
  ✓  tests/luna.e2e.spec.ts:3:1 › 0to1: quote api is mocked
  1 passed
```

결과를 이렇게 읽으면 됩니다.

- `1 passed`면 라우팅 모킹이 실제 브라우저 컨텍스트에서 정상 동작합니다.
- 여기서 실패하면 endpoint 패턴(`urlPattern`)이나 `mode: "strict"` 매핑 누락을 먼저 확인하면 됩니다.

## 4) CLI 실행 확인

```bash
pnpm exec lunatest run
pnpm exec lunatest gen --ai
```

기대 출력:

```text
Scenario Summary
filter=all
passed=1
failed=0
```

```text
AI generation complete
created=1
executed=1
```

결과를 이렇게 읽으면 됩니다.

- `run` 출력은 시나리오 실행 요약입니다.
- `gen --ai` 출력의 `created`, `executed` 값으로 생성/실행 여부를 바로 확인할 수 있습니다.

## 5) MCP stdio 실행 확인

```bash
printf '%s\n' \
  '{"id":"1","method":"scenario.create","params":{"id":"swap-smoke","name":"Swap Smoke"}}' \
  '{"id":"2","method":"scenario.run","params":{"id":"swap-smoke"}}' \
  | pnpm exec lunatest-mcp
```

기대 출력(줄별):

```json
{"id":"1","result":{"id":"swap-smoke","name":"Swap Smoke"}}
{"id":"2","result":{"id":"swap-smoke","pass":true}}
```

결과를 이렇게 읽으면 됩니다.

- 첫 줄은 시나리오 생성 성공 여부
- 둘째 줄은 실행 결과(`pass`) 확인

## 6) 최종 체크리스트

- Playwright 테스트가 `1 passed`로 끝나는가
- `lunatest run` 결과에 `passed`/`failed` 요약이 보이는가
- `lunatest gen --ai`에 `created`, `executed`가 찍히는가
- `lunatest-mcp` 응답에서 `scenario.create -> scenario.run` 흐름이 보이는가

여기까지 확인되면 "설치해서 처음 붙여보는 단계"는 통과입니다.
이후에는 프로젝트 도메인 시나리오를 추가하고, CI 게이트에 연결하면 됩니다.
