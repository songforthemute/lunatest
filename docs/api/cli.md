# API: @lunatest/cli

배포 채널: `latest`

CLI는 아래 여섯 가지 흐름을 중심으로 사용합니다.

- `lunatest run --scenario <file|glob>`
- `lunatest watch`
- `lunatest coverage`
- `lunatest gen --ai`
- `lunatest devtools --open`
- `lunatest doctor`

일반적으로 로컬에서는 `run/devtools/doctor`, CI에서는 `coverage`와 `run` 조합을 많이 사용합니다.

## `lunatest.config.json`

CLI는 선택적으로 프로젝트 루트의 `lunatest.config.json`을 읽습니다.

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

## Command Semantics

- `run`
  - 기본 source set은 `luaConfigPath` + `scenarioDir/**/*.lua`
  - filter는 실행 전에 적용됩니다.
- `watch`
  - 시작 시 1회 `run`
  - `luaConfigPath`와 `scenarioDir/**/*.lua` 변경 시 debounce 후 재실행
- `coverage`
  - scenario-level coverage JSON을 출력합니다.
  - 필드:
    - `total`
    - `covered`
    - `ratio`
    - `known`
    - `coveredTargets`
    - `missing`
- `gen --ai`
  - `ai.command`가 필요합니다.
  - adapter stdin JSON에는 `scenarios`, `coverage`, `presetCatalog`, `prompts`가 들어갑니다.
  - adapter stdout은 generated scenario array JSON이어야 합니다.
- `doctor`
  - resolved config path, scenario paths, runtime guard, AI adapter 상태를 출력합니다.
