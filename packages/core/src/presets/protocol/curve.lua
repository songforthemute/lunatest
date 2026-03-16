return {
  manifest = {
    id = "curve",
    label = "Curve",
    description = "Built-in stable swap preset.",
    kind = "dex",
    supportedChains = { 1 },
    protocol = "curve",
    version = "v1",
    components = {
      invariant = "stable_swap",
      router = "pool_router",
    },
    defaultWalletPreset = {
      id = "empty_wallet",
    },
    defaultInterceptState = {
      protocol = {
        id = "curve",
      },
    },
    defaultRouteMocks = {},
    builtinScenarios = {
      {
        id = "imbalanced_pool",
        label = "Imbalanced Pool",
        lua = "scenario { name = 'imbalanced_pool', given = { pool = { imbalance = true } } }",
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
        key = "poolName",
        label = "Pool",
        type = "string",
        required = true,
        default = "3pool",
      },
    },
    recommendedControls = { "poolName" },
  },

  materialize = function(params)
    local chainId = tonumber(params.chainId or 1)
    local poolName = tostring(params.poolName or "3pool")

    return {
      resolvedParams = {
        chainId = chainId,
        poolName = poolName,
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
          id = "curve",
          version = "v1",
          components = {
            invariant = "stable_swap",
            router = "pool_router",
          },
        },
        pool = {
          name = poolName,
        },
      },
      routeMocks = {},
    }
  end,
}
