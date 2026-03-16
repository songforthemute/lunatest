return {
  manifest = {
    id = "uniswap_v3",
    label = "Uniswap V3",
    description = "Built-in concentrated liquidity DEX preset.",
    kind = "dex",
    supportedChains = { 1, 11155111 },
    protocol = "uniswap",
    version = "v3",
    components = {
      quoter = "v2",
      router = "swap_router_02",
    },
    defaultWalletPreset = {
      id = "demo_sepolia",
    },
    defaultInterceptState = {
      chain = {
        id = 11155111,
        gasPriceGwei = 30,
      },
      protocol = {
        id = "uniswap_v3",
      },
    },
    defaultRouteMocks = {},
    builtinScenarios = {
      {
        id = "approval_required",
        label = "Approval Required",
        lua = "scenario { name = 'approval_required', given = { wallet = { connected = true } } }",
      },
      {
        id = "swap_pending",
        label = "Swap Pending",
        lua = "scenario { name = 'swap_pending', given = { chaos = { pendingForMs = 600000 } } }",
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
      {
        key = "feeTier",
        label = "Fee Tier",
        type = "enum",
        required = true,
        default = 3000,
        options = { 500, 3000, 10000 },
      },
      {
        key = "quoter",
        label = "Quoter",
        type = "enum",
        required = true,
        default = "v2",
        options = { "v1", "v2" },
      },
    },
    recommendedControls = { "chainId", "tokenIn", "tokenOut", "feeTier", "quoter" },
  },

  materialize = function(params)
    local chainId = tonumber(params.chainId or 11155111)
    local tokenIn = tostring(params.tokenIn or "0xfff9976782d46cc05630d1f6ebab18b2324d6b14")
    local tokenOut = tostring(params.tokenOut or "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238")
    local feeTier = tonumber(params.feeTier or 3000)
    local quoter = tostring(params.quoter or "v2")

    return {
      resolvedParams = {
        chainId = chainId,
        tokenIn = tokenIn,
        tokenOut = tokenOut,
        feeTier = feeTier,
        quoter = quoter,
      },
      walletPreset = {
        id = "demo_sepolia",
        overrides = {
          chainId = string.format("0x%x", chainId),
        },
      },
      walletSessionOverrides = {
        assets = {
          nativeBalance = "1",
          tokens = {
            [string.lower(tokenIn)] = {
              balance = "25",
              allowance = "0",
              symbol = "TOKEN_IN",
              decimals = 18,
            },
            [string.lower(tokenOut)] = {
              balance = "0",
              allowance = "0",
              symbol = "TOKEN_OUT",
              decimals = 18,
            },
          },
        },
      },
      interceptState = {
        chain = {
          id = chainId,
          gasPriceGwei = 30,
        },
        protocol = {
          id = "uniswap_v3",
          version = "v3",
          components = {
            quoter = quoter,
            router = "swap_router_02",
          },
        },
        pool = {
          tokenIn = tokenIn,
          tokenOut = tokenOut,
          feeTier = feeTier,
        },
      },
      routeMocks = {},
    }
  end,
}
