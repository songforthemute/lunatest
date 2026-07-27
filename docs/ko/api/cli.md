# API: @lunatest/cli

배포 채널: `latest`

`@lunatest/cli`는 `lunatest` 실행 파일을 설치합니다. working directory의 optional `lunatest.config.json`을 읽고, config가 없으면 built-in default를 사용합니다.

## `lunatest.config.json`

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
    "args": ["./adapter.mjs"],
    "env": { "MODEL": "example" }
  }
}
```

`scenarioDir`, `luaConfigPath`는 config directory 기준으로 해석됩니다. `coverageCatalog`는 known feature/state/component target을 추가합니다. `ai`는 `gen --ai`에만 필요합니다.

## Command

- `run`은 구성된 Lua config와 scenario directory, 또는 optional filter / `--scenario <fileOrGlob>` 선택을 실행합니다.
- `validate`는 선택된 source set을 실행하지 않고 parse합니다. parse failure가 있으면 command가 실패합니다.
- `watch`는 시작 시 한 번 `run`한 뒤 `luaConfigPath` 또는 `scenarioDir/**/*.lua` 변경 후 300 ms debounce를 거쳐 재실행합니다. `SIGINT`까지 지속합니다.
- `coverage`는 `total`, `covered`, `ratio`, `known`, `coveredTargets`, `missing` JSON을 출력합니다.
- `gen`은 `--ai`가 필요합니다. 구성된 external command는 stdin으로 `scenarios`, `coverage`, `presetCatalog`, `prompts` JSON object를 받고 stdout으로 generated scenario JSON array를 반환해야 합니다. 생성된 Lua는 `scenarioDir`에 저장한 뒤 validate와 run을 수행합니다. invalid JSON, invalid Lua, duplicate target filename은 명시적으로 실패합니다.
- `devtools`는 project-aware browser devtools setup guide를 출력합니다. mounting guide는 `--open`을 추가해야 하며, option 없이 호출하면 error입니다.
- `doctor`는 resolved config path, scenario source presence, runtime-intercept enable policy, AI adapter configuration state를 출력합니다.

로컬 개발에는 일반 `lunatest` command를 사용합니다. `pnpm run test:e2e:smoke:ci` 같은 CI wrapper는 repository CI workflow용이며 해당 테스트 전에 workspace package를 prebuild합니다.
