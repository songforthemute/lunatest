# Local Preset Authoring

Use project-local Lua presets when your team needs protocol or wallet behavior that the built-in catalog does not cover.

LunaTest discovers local presets from these directories:

```text
./lunatest/presets/protocol/**/*.lua
./lunatest/presets/wallet/**/*.lua
```

Discovered presets are exposed with the `project/*` namespace.

- Built-in preset example: `builtin/uniswap_v3`
- Project-local preset example: `project/team_swap`

## Protocol Preset Example

Copy this shape to `./lunatest/presets/protocol/team_swap.lua`.

```lua
return {
  manifest = {
    id = "team_swap",
    label = "Team Swap",
    description = "Team-specific swap flow on Sepolia.",
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

## Wallet Preset Example

Copy this shape to `./lunatest/presets/wallet/team_wallet.lua`.

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

## Manifest Rules

### Protocol preset

Required fields:

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

Required fields:

- `id`
- `label`
- `kind = "wallet"`
- `supportedChains`
- `defaultSession`

Optional fields:

- `paramsSchema`
- `recommendedControls`

## `materialize(params)` Rules

`materialize(params)` lets the preset turn user input into runtime state.

For protocol presets, LunaTest expects some or all of:

- `walletPreset`
- `walletSessionOverrides`
- `interceptState`
- `routeMocks`
- `builtinScenarios`
- `resolvedParams`

For wallet presets, LunaTest expects:

- `defaultSession`

If a returned field has the wrong shape, the preset is excluded from the catalog and a diagnostic is recorded.

## Qualified IDs

The manifest `id` stays local and short, such as `team_swap`.

At runtime, LunaTest exposes a qualified id:

- built-in: `builtin/<id>`
- project-local: `project/<id>`

Use qualified ids when you reference presets across the registry surface.

Example:

```lua
defaultWalletPreset = {
  id = "project/team_wallet",
}
```

## `defaultWalletPreset` Reference Rules

Protocol presets reference wallet presets by id.

- `builtin/demo_sepolia` points to a built-in wallet preset
- `project/team_wallet` points to a project-local wallet preset

If the referenced wallet preset does not exist, LunaTest records a `preset_wallet_reference_missing` diagnostic and hides the protocol preset from the catalog.

## `recommendedControls` Rules

`recommendedControls` must be a subset of `paramsSchema[*].key`.

This drives the compact Devtools form. Keep it to 3-5 frequently changed params.

Good:

```lua
paramsSchema = {
  { key = "chainId", label = "Chain", type = "chainId" },
  { key = "tokenIn", label = "Token In", type = "address" },
  { key = "tokenOut", label = "Token Out", type = "address" },
},
recommendedControls = { "chainId", "tokenIn", "tokenOut" }
```

Bad:

```lua
recommendedControls = { "tokenIn", "missingParam" }
```

This produces `preset_recommended_control_unknown`.

## Common Diagnostics

### `preset_manifest_invalid`

The manifest is missing a required field or has the wrong type.

Example message:

```text
missing field: protocol
```

### `preset_wallet_reference_missing`

The protocol preset references a wallet preset that does not exist.

Example:

```text
defaultWalletPreset.id not found: project/team_wallet
```

### `preset_recommended_control_unknown`

`recommendedControls` points to a param key that is not in `paramsSchema`.

### `preset_unsupported_chain`

The preset was materialized with a chain not included in `supportedChains`.

### `preset_materialize_invalid_default_session`

The wallet preset returned a malformed `defaultSession`.

### `preset_materialize_invalid_route_mocks`

The protocol preset returned malformed `routeMocks`.

## Where Diagnostics Show Up

- `@lunatest/core`
  - `getPresetDiagnostics(registry?)`
  - `validateProtocolPresetSource(source, context?)`
  - `validateWalletPresetSource(source, context?)`
- `@lunatest/mcp`
  - `mock.listPresetDiagnostics`
  - `mock.getPresetDiagnostic`
- Devtools
  - diagnostics badge and diagnostics panel

Malformed local presets do not break the entire registry. LunaTest keeps valid presets visible and reports invalid ones separately.

## Copyable Team Examples

You can start from the sample app presets directly:

- [`team_swap.lua`](/Users/joeylee/lunatest/examples/swap-dapp/lunatest/presets/protocol/team_swap.lua)
- [`team_wallet.lua`](/Users/joeylee/lunatest/examples/swap-dapp/lunatest/presets/wallet/team_wallet.lua)

These are the same shapes used by the sample app bootstrap path.
