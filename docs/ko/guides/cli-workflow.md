# CLI 워크플로 가이드

LunaTest CLI는 `run`, `watch`, `coverage`, `gen --ai` 흐름을 제공합니다.

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

예상 출력:

```text
Watch mode
status=idle
```

## 3) coverage

```bash
node packages/cli/dist/index.js coverage
```

예상 출력:

```json
{
  "total": 1,
  "covered": 1,
  "ratio": 1
}
```

## 4) gen --ai

```bash
node packages/cli/dist/index.js gen --ai
```

예상 출력:

```text
AI generation complete
created=1
executed=1
```

## 자주 발생하는 실수

- `gen`을 `--ai` 없이 실행하면 실패로 처리됩니다.
- 빌드 전 `dist` 경로를 직접 실행하면 파일이 없어서 실패할 수 있습니다.
