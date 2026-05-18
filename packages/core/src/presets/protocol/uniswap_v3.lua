local function protocol_routes()
  return {
    { endpointType = "ethereum", method = "eth_call", responseKey = "protocol.runtime" },
    { endpointType = "ethereum", method = "eth_sendTransaction", responseKey = "protocol.runtime" },
    { endpointType = "ethereum", method = "eth_getTransactionReceipt", responseKey = "protocol.runtime" },
    { endpointType = "ethereum", method = "eth_getLogs", responseKey = "protocol.runtime" },
  }
end

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
    defaultRouteMocks = protocol_routes(),
    builtinScenarios = {
      { id = "quote_success", label = "Quote Success", lua = "scenario { name = 'quote_success', when = { action = 'quote' } }" },
      { id = "approval_required", label = "Approval Required", lua = "scenario { name = 'approval_required', given = { wallet = { connected = true } } }" },
      { id = "approve_success", label = "Approve Success", lua = "scenario { name = 'approve_success', when = { action = 'approve' } }" },
      { id = "transaction_pending", label = "Transaction Pending", lua = "scenario { name = 'transaction_pending', given = { chaos = { pendingForMs = 600000 } } }" },
      { id = "transaction_reverted", label = "Transaction Reverted", lua = "scenario { name = 'transaction_reverted', given = { chaos = { forceRevert = true } } }" },
      { id = "high_slippage", label = "High Slippage", lua = "scenario { name = 'high_slippage', given = { pool = { slippagePctOverride = 12 } } }" },
    },
    paramsSchema = {
      { key = "chainId", label = "Chain", type = "chainId", required = true, default = 11155111, options = { 1, 11155111 } },
      { key = "tokenIn", label = "Token In", type = "address", required = true, default = "0xfff9976782d46cc05630d1f6ebab18b2324d6b14" },
      { key = "tokenOut", label = "Token Out", type = "address", required = true, default = "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238" },
      { key = "feeTier", label = "Fee Tier", type = "enum", required = true, default = 3000, options = { 500, 3000, 10000 } },
      { key = "quoter", label = "Quoter", type = "enum", required = true, default = "v2", options = { "v1", "v2" } },
    },
    recommendedControls = { "chainId", "tokenIn", "tokenOut", "feeTier", "quoter" },
  },

  materialize = function(params)
    local chainId = tonumber(params.chainId or 11155111)
    local tokenIn = tostring(params.tokenIn or "0xfff9976782d46cc05630d1f6ebab18b2324d6b14")
    local tokenOut = tostring(params.tokenOut or "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238")
    local tokenInKey = string.lower(tokenIn)
    local tokenOutKey = string.lower(tokenOut)
    local feeTier = tonumber(params.feeTier or 3000)
    local quoter = tostring(params.quoter or "v2")
    local router = "0xe592427a0aece92de3edee1f18e0157c05861564"
    local quoterAddress = "0x61ffe014ba17989e743c5f6cb21bf9697530b21e"
    local pool = "0x1111111111111111111111111111111111113000"

    return {
      resolvedParams = { chainId = chainId, tokenIn = tokenIn, tokenOut = tokenOut, feeTier = feeTier, quoter = quoter },
      walletPreset = { id = "demo_sepolia", overrides = { chainId = string.format("0x%x", chainId) } },
      walletSessionOverrides = {
        assets = {
          nativeBalance = "1000000000000000000",
          tokens = {
            [tokenInKey] = { balance = "25", allowance = "0", symbol = "TOKEN_IN", decimals = 18 },
            [tokenOutKey] = { balance = "0", allowance = "0", symbol = "TOKEN_OUT", decimals = 18 },
          },
        },
      },
      interceptState = {
        chain = { id = chainId, gasPriceGwei = 30 },
        protocol = { id = "uniswap_v3", version = "v3", components = { quoter = quoter, router = "swap_router_02" } },
        protocolRuntime = {
          activeProtocol = "uniswap_v3",
          supportLevel = "L3",
          chainId = chainId,
          contracts = { router = router, quoter = quoterAddress, pool = pool },
          tokens = {
            [tokenInKey] = { symbol = "TOKEN_IN", decimals = 18 },
            [tokenOutKey] = { symbol = "TOKEN_OUT", decimals = 18 },
          },
          uniswapV3 = {
            router = router,
            quoter = quoterAddress,
            quoterVersion = quoter,
            pools = {
              { address = pool, token0 = tokenIn, token1 = tokenOut, fee = feeTier, priceNumerator = "1800", priceDenominator = "1", liquidity = "1000000" },
            },
          },
        },
      },
      routeMocks = protocol_routes(),
    }
  end,
}
