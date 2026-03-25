return {
  manifest = {
    id = "aave",
    label = "Aave",
    description = "Built-in lending market preset.",
    kind = "lending",
    supportedChains = { 1 },
    protocol = "aave",
    version = "v3",
    components = {
      pool = "v3_pool",
      oracle = "price_oracle",
    },
    defaultWalletPreset = {
      id = "empty_wallet",
    },
    defaultInterceptState = {
      protocol = {
        id = "aave",
      },
    },
    defaultRouteMocks = {},
    builtinScenarios = {
      {
        id = "health_factor_warning",
        label = "Health Factor Warning",
        lua = "scenario { name = 'health_factor_warning', given = { wallet = { healthFactor = 1.02 } } }",
      },
    },
    paramsSchema = {
      {
        key = "chainId",
        label = "Chain",
        type = "chainId",
        required = true,
        default = 1,
        options = { 1 },
      },
      {
        key = "reserve",
        label = "Reserve",
        type = "string",
        required = true,
        default = "USDC",
      },
    },
    recommendedControls = { "reserve" },
  },

  materialize = function(params)
    local chainId = tonumber(params.chainId or 1)
    local reserve = tostring(params.reserve or "USDC")

    return {
      resolvedParams = {
        chainId = chainId,
        reserve = reserve,
      },
      walletPreset = {
        id = "empty_wallet",
        overrides = {
          chainId = string.format("0x%x", chainId),
        },
      },
      interceptState = {
        chain = { id = chainId },
        protocol = {
          id = "aave",
          version = "v3",
          components = {
            pool = "v3_pool",
            oracle = "price_oracle",
          },
        },
        market = {
          reserve = reserve,
        },
      },
      routeMocks = {},
    }
  end,
}
