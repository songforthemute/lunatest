return {
  manifest = {
    id = "uniswap_v2",
    label = "Uniswap V2",
    description = "Built-in constant product DEX preset.",
    kind = "dex",
    supportedChains = { 1, 11155111 },
    protocol = "uniswap",
    version = "v2",
    components = {
      router = "router_02",
      pricing = "pair_reserves",
    },
    defaultWalletPreset = {
      id = "demo_sepolia",
    },
    defaultInterceptState = {
      protocol = {
        id = "uniswap_v2",
      },
    },
    defaultRouteMocks = {},
    builtinScenarios = {
      {
        id = "price_impact_warning",
        label = "Price Impact Warning",
        lua = "scenario { name = 'price_impact_warning', given = { chaos = { slippagePctOverride = 12 } } }",
      },
    },
    paramsSchema = {
      {
        key = "chainId",
        label = "Chain",
        type = "chainId",
        required = true,
        default = 11155111,
        options = { 1, 11155111 },
      },
      {
        key = "tokenIn",
        label = "Token In",
        type = "address",
        required = true,
        default = "0xfff9976782d46cc05630d1f6ebab18b2324d6b14",
      },
      {
        key = "tokenOut",
        label = "Token Out",
        type = "address",
        required = true,
        default = "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238",
      },
    },
    recommendedControls = { "chainId", "tokenIn", "tokenOut" },
  },

  materialize = function(params)
    local chainId = tonumber(params.chainId or 11155111)
    local tokenIn = tostring(params.tokenIn or "0xfff9976782d46cc05630d1f6ebab18b2324d6b14")
    local tokenOut = tostring(params.tokenOut or "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238")

    return {
      resolvedParams = {
        chainId = chainId,
        tokenIn = tokenIn,
        tokenOut = tokenOut,
      },
      walletPreset = {
        id = "demo_sepolia",
        overrides = {
          chainId = string.format("0x%x", chainId),
        },
      },
      interceptState = {
        chain = { id = chainId },
        protocol = {
          id = "uniswap_v2",
          version = "v2",
          components = {
            router = "router_02",
            pricing = "pair_reserves",
          },
        },
        pair = {
          tokenIn = tokenIn,
          tokenOut = tokenOut,
        },
      },
      routeMocks = {},
    }
  end,
}
