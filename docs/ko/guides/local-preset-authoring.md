# Local Preset 작성 가이드

팀 전용 컨트랙트 문맥이나 제품별 프로토콜 흐름을 테스트하려면 project-local Lua preset을 사용하면 됩니다.

LunaTest는 아래 디렉터리에서 local preset을 찾습니다.

```text
./lunatest/presets/protocol/**/*.lua
./lunatest/presets/wallet/**/*.lua
```

찾아낸 preset은 `project/*` 네임스페이스로 노출됩니다.

- built-in 예시: `builtin/uniswap_v3`
- project-local 예시: `project/team_swap`

## Protocol Preset 최소 예제

`./lunatest/presets/protocol/team_swap.lua`에 아래 형태로 작성하면 됩니다.

```lua
return {
  manifest = {
    id = "team_swap",
    label = "Team Swap",
    description = "팀 전용 Sepolia 스왑 플로우",
    kind = "dex",
    supportedChains = { 11155111 },
    protocol = "teamdex",
    version = "v1",
    components = {
      quoter = "local",
      router = "team_router",
    },
    defaultWalletPreset = {
      id = "project/team_wallet",
    },
    defaultInterceptState = {
      protocol = {
        id = "team_swap",
      },
    },
    defaultRouteMocks = {},
    builtinScenarios = {
      {
        id = "price_spike",
        label = "Price Spike",
        lua = "scenario { name = 'price_spike', given = { price = { spike = true } } }",
      },
    },
    paramsSchema = {
      {
        key = "chainId",
        label = "Chain",
        type = "chainId",
        required = true,
        default = 11155111,
      },
      {
        key = "tokenIn",
        label = "Token In",
        type = "address",
        required = true,
      },
      {
        key = "tokenOut",
        label = "Token Out",
        type = "address",
        required = true,
      },
    },
    recommendedControls = { "chainId", "tokenIn", "tokenOut" },
  },

  materialize = function(params)
    return {
      walletPreset = {
        id = "project/team_wallet",
      },
      interceptState = {
        chain = {
          id = tonumber(params.chainId or 11155111),
        },
        pool = {
          tokenIn = tostring(params.tokenIn or ""),
          tokenOut = tostring(params.tokenOut or ""),
        },
      },
      routeMocks = {},
    }
  end,
}
```

## Wallet Preset 최소 예제

`./lunatest/presets/wallet/team_wallet.lua`에는 아래 형태를 사용합니다.

```lua
return {
  manifest = {
    id = "team_wallet",
    label = "Team Wallet",
    kind = "wallet",
    supportedChains = { 11155111 },
    defaultSession = {
      enabled = true,
      connected = true,
      chainId = "0xaa36a7",
      accounts = { "0x1111111111111111111111111111111111111111" },
      permissions = {},
      assets = {
        nativeBalance = "1",
        tokens = {},
      },
    },
    paramsSchema = {
      {
        key = "address",
        label = "Wallet Address",
        type = "address",
        required = false,
      },
    },
    recommendedControls = { "address" },
  },

  materialize = function(params)
    return {
      defaultSession = {
        accounts = params.address and { tostring(params.address) } or nil,
      },
    }
  end,
}
```

## Manifest 규칙

### Protocol preset

필수 필드:

- `id`
- `label`
- `kind`
- `supportedChains`
- `protocol`
- `version`
- `components`
- `defaultWalletPreset`
- `defaultInterceptState`
- `defaultRouteMocks`
- `builtinScenarios`
- `paramsSchema`
- `recommendedControls`

### Wallet preset

필수 필드:

- `id`
- `label`
- `kind = "wallet"`
- `supportedChains`
- `defaultSession`

선택 필드:

- `paramsSchema`
- `recommendedControls`

## `materialize(params)` 규칙

`materialize(params)`는 입력값을 실제 런타임 상태로 바꾸는 단계입니다.

Protocol preset은 보통 아래 필드를 반환합니다.

- `walletPreset`
- `walletSessionOverrides`
- `interceptState`
- `routeMocks`
- `builtinScenarios`
- `resolvedParams`

Wallet preset은 보통 아래 필드를 반환합니다.

- `defaultSession`

반환 shape가 잘못되면 해당 preset은 catalog에서 빠지고 diagnostics에만 남습니다.

## Qualified ID

manifest 안의 `id`는 `team_swap`처럼 짧게 유지합니다.

런타임에서는 아래처럼 qualified id로 노출됩니다.

- built-in: `builtin/<id>`
- project-local: `project/<id>`

다른 preset을 참조하거나 MCP/Devtools에서 선택할 때는 이 qualified id를 기준으로 보면 됩니다.

예시:

```lua
defaultWalletPreset = {
  id = "project/team_wallet",
}
```

## `defaultWalletPreset` 참조 규칙

Protocol preset은 wallet preset을 id로 참조합니다.

- `builtin/demo_sepolia`
- `project/team_wallet`

참조 대상이 없으면 `preset_wallet_reference_missing` 진단이 기록되고, 해당 protocol preset은 catalog에 노출되지 않습니다.

## `recommendedControls` 규칙

`recommendedControls`는 반드시 `paramsSchema[*].key`의 부분집합이어야 합니다.

이 값이 Devtools의 compact form을 만듭니다. 자주 바꾸는 3~5개만 넣는 편이 좋습니다.

좋은 예:

```lua
paramsSchema = {
  { key = "chainId", label = "Chain", type = "chainId" },
  { key = "tokenIn", label = "Token In", type = "address" },
  { key = "tokenOut", label = "Token Out", type = "address" },
},
recommendedControls = { "chainId", "tokenIn", "tokenOut" }
```

잘못된 예:

```lua
recommendedControls = { "tokenIn", "missingParam" }
```

이 경우 `preset_recommended_control_unknown`가 기록됩니다.

## 자주 보는 Diagnostics

### `preset_manifest_invalid`

manifest 필수 필드가 빠졌거나 타입이 맞지 않을 때 나옵니다.

예시:

```text
missing field: protocol
```

### `preset_wallet_reference_missing`

존재하지 않는 wallet preset을 참조할 때 나옵니다.

예시:

```text
defaultWalletPreset.id not found: project/team_wallet
```

### `preset_recommended_control_unknown`

`recommendedControls`가 `paramsSchema`에 없는 key를 가리킬 때 나옵니다.

### `preset_unsupported_chain`

`supportedChains`에 없는 체인으로 materialize 했을 때 나옵니다.

### `preset_materialize_invalid_default_session`

wallet preset이 잘못된 `defaultSession`을 반환했을 때 나옵니다.

### `preset_materialize_invalid_route_mocks`

protocol preset이 잘못된 `routeMocks`를 반환했을 때 나옵니다.

## Diagnostics가 보이는 위치

- `@lunatest/core`
  - `getPresetDiagnostics(registry?)`
  - `validateProtocolPresetSource(source, context?)`
  - `validateWalletPresetSource(source, context?)`
- `@lunatest/mcp`
  - `mock.listPresetDiagnostics`
  - `mock.getPresetDiagnostic`
- Devtools
  - diagnostics badge
  - diagnostics panel

local preset 하나가 잘못되어도 registry 전체가 깨지지는 않습니다. 정상 preset은 계속 노출되고, 잘못된 preset만 diagnostics로 분리해서 보여줍니다.

## 바로 가져다 쓸 수 있는 예제

샘플 앱 예제를 그대로 시작점으로 써도 됩니다.

- [`team_swap.lua`](/Users/joeylee/lunatest/examples/swap-dapp/lunatest/presets/protocol/team_swap.lua)
- [`team_wallet.lua`](/Users/joeylee/lunatest/examples/swap-dapp/lunatest/presets/wallet/team_wallet.lua)

이 두 파일이 sample app bootstrap 경로에서 실제로 쓰는 local preset 예제입니다.
