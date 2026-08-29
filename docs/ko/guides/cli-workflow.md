# CLI 워크플로 가이드

LunaTest CLI는 `validate`, `run`, `watch`, `coverage`, `gen --ai`, `doctor`,
`devtools --open` 흐름을 제공합니다.

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

시나리오를 소유한 프로젝트에 배포된 CLI를 설치한 뒤, 그 프로젝트 루트에서
`pnpm exec lunatest <command>`를 실행합니다.

```bash
pnpm add -D @lunatest/cli
```

## 1) validate와 run

```bash
pnpm exec lunatest validate
pnpm exec lunatest run
```

`validate`는 선택된 Lua source를 실행하지 않고 parse합니다. `run`은 scenario를
실행하며 실패가 있으면 non-zero로 종료합니다. 두 명령 모두
`--scenario <file-or-glob>`으로 source set을 좁힐 수 있습니다.

`run`의 예상 출력:

```text
Scenario Summary
filter=all
passed=1
failed=0
```

필터 지정:

```bash
pnpm exec lunatest run swap
```

## 2) watch

```bash
pnpm exec lunatest watch
```

동작:

```text
Scenario Summary
...
```

- 시작 시 1회 실행
- `luaConfigPath`, `scenarioDir/**/*.lua` 변경 시 debounce 후 재실행
- recursive watch가 불가능한 환경에서는 polling fallback으로 계속 감시

## 3) coverage

```bash
pnpm exec lunatest coverage
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
pnpm exec lunatest gen --ai
```

전제:

- `lunatest.config.json`에 `ai.command`가 있어야 합니다.
- adapter는 stdin JSON을 받고 stdout JSON array를 반환해야 합니다.
- adapter가 `coverage`, `tags`를 반환하면 generated `.lua`에도 metadata가 함께 저장됩니다.

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
- 전역 설치 대신 프로젝트에 설치한 CLI를 `pnpm exec lunatest`로 실행합니다.

## 5) doctor

```bash
pnpm exec lunatest doctor
```

`doctor`는 resolved config path, scenario source 위치, runtime-intercept guard와
현재 enablement, AI adapter 설정을 보고합니다.

## 6) devtools --open

```bash
pnpm exec lunatest devtools --open
```

출력:

- resolved config path
- resolved `luaConfigPath`
- resolved `scenarioDir`
- browser entry (`@lunatest/react/browser`)
- `bootstrapLunaRuntime()` / `mountLunaDevtools()` guide
- local preset directory path
