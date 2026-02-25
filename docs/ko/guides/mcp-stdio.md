# MCP stdio 사용 가이드

LunaTest MCP 서버는 줄 단위 JSON-RPC를 stdin/stdout으로 주고받습니다.

## 1) 빌드

```bash
pnpm --filter @lunatest/mcp build
```

## 2) 서버 실행

```bash
node packages/mcp/dist/bin/mcp-stdio.js
```

## 3) 단일 요청 예시

`scenario.list`를 요청하면 기본 상태에서는 빈 배열이 반환됩니다.

```bash
echo '{"id":"1","method":"scenario.list"}' | node packages/mcp/dist/bin/mcp-stdio.js
```

예상 응답:

```json
{"id":"1","result":[]}
```

## 4) 다중 요청 예시 (생성 후 실행)

같은 프로세스에서 여러 줄을 보내면, 앞줄에서 만든 시나리오를 다음 줄에서 바로 실행할 수 있습니다.

```bash
printf '%s\n' \
  '{"id":"1","method":"scenario.create","params":{"id":"swap-smoke","name":"Swap Smoke"}}' \
  '{"id":"2","method":"scenario.run","params":{"id":"swap-smoke"}}' \
  | node packages/mcp/dist/bin/mcp-stdio.js
```

예상 응답(줄별):

```json
{"id":"1","result":{"id":"swap-smoke","name":"Swap Smoke"}}
{"id":"2","result":{"id":"swap-smoke","pass":true}}
```

## 5) 커버리지/프롬프트 조회 예시

```bash
printf '%s\n' \
  '{"id":"10","method":"coverage.report"}' \
  '{"id":"11","method":"prompt.list"}' \
  | node packages/mcp/dist/bin/mcp-stdio.js
```

## 주의사항

- JSON 한 줄당 요청 1개 형식이어야 합니다.
- `id`와 `method`는 문자열이어야 합니다.
- 잘못된 payload를 보내면 error 응답이 반환됩니다.
