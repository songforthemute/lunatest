# CLI 워크플로 가이드

LunaTest CLI는 `run`, `watch`, `coverage`, `gen --ai` 흐름을 제공합니다.

선택적으로 프로젝트 루트 `lunatest.config.json`을 읽습니다.

```json
{
  "scenarioDir": "scenarios",
  "luaConfigPath": "lunatest.lua",
  "coverageCatalog": {
    "features": ["swap", "approve"],
    "states": ["quoteLoaded", "approvalPending"],
    "components": ["quotePanel", "actionButtonRow"]
  },
  "ai": {
    "command": "node",
    "args": ["./adapter.mjs"]
  }
}
```

## 빌드

```bash
pnpm --filter @lunatest/cli build
```

## 1) run

```bash
node packages/cli/dist/index.js run
```

예상 출력:

```text
Scenario Summary
filter=all
passed=1
failed=0
```

필터 지정:

```bash
node packages/cli/dist/index.js run swap
```

## 2) watch

```bash
node packages/cli/dist/index.js watch
```

동작:

```text
Scenario Summary
...
```

- 시작 시 1회 실행
- `luaConfigPath`, `scenarioDir/**/*.lua` 변경 시 debounce 후 재실행

## 3) coverage

```bash
node packages/cli/dist/index.js coverage
```

출력 필드:

```json
{
  "total": 4,
  "covered": 2,
  "ratio": 0.5,
  "known": { "features": [], "states": [], "components": [] },
  "coveredTargets": { "features": [], "states": [], "components": [] },
  "missing": { "features": [], "states": [], "components": [] }
}
```

## 4) gen --ai

```bash
node packages/cli/dist/index.js gen --ai
```

전제:

- `lunatest.config.json`에 `ai.command`가 있어야 합니다.
- adapter는 stdin JSON을 받고 stdout JSON array를 반환해야 합니다.

출력 예시:

```text
AI generation complete
created=1
validated=1
executed=1
```

## 자주 나오는 실수

- `gen`을 `--ai` 없이 실행하면 실패로 처리됩니다.
- `gen --ai`를 쓰려면 `ai.command`가 필요합니다.
- 빌드 전에 `dist` 경로를 직접 실행하면 파일이 없어 실패할 수 있습니다.
