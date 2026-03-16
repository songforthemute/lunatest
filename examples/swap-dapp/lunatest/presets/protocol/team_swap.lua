return {
  manifest = {
    id = "team_swap",
    label = "Team Swap (Local)",
    description = "Project-local Uniswap V3 flavored preset for the swap demo.",
    kind = "dex",
    supportedChains = { 11155111 },
    protocol = "teamdex",
    version = "v1",
    components = {
      quoter = "team_quote_engine",
      router = "team_router",
    },
    defaultWalletPreset = {
      id = "team_wallet",
    },
    defaultInterceptState = {
      chain = {
        id = 11155111,
        gasPriceGwei = 30,
      },
      protocol = {
        id = "team_swap",
      },
    },
    defaultRouteMocks = {},
    builtinScenarios = {
      {
        id = "team_pending",
        label = "Team Pending",
        lua = "scenario { name = 'team_pending', given = { chaos = { pendingForMs = 15000 } } }",
      },
    },
    paramsSchema = {
      {
        key = "chainId",
        label = "Chain",
        type = "chainId",
        required = true,
        default = 11155111,
        options = { 11155111 },
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
    recommendedControls = { "tokenIn", "tokenOut" },
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
        id = "team_wallet",
      },
      walletSessionOverrides = {
        assets = {
          nativeBalance = "1",
          tokens = {
            [string.lower(tokenIn)] = {
              balance = "50",
              allowance = "0",
              symbol = "TEAM_IN",
              decimals = 18,
            },
            [string.lower(tokenOut)] = {
              balance = "0",
              allowance = "0",
              symbol = "TEAM_OUT",
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
          id = "team_swap",
          version = "v1",
          components = {
            quoter = "team_quote_engine",
            router = "team_router",
          },
        },
      },
      routeMocks = {},
    }
  end,
}
