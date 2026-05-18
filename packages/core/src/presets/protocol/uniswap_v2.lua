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
    id = "uniswap_v2",
    label = "Uniswap V2",
    description = "Built-in constant product DEX preset.",
    kind = "dex",
    supportedChains = { 1, 11155111 },
    protocol = "uniswap",
    version = "v2",
    components = { router = "router_02", pricing = "pair_reserves" },
    defaultWalletPreset = { id = "demo_sepolia" },
    defaultInterceptState = { protocol = { id = "uniswap_v2" } },
    defaultRouteMocks = protocol_routes(),
    builtinScenarios = {
      { id = "quote_success", label = "Quote Success", lua = "scenario { name = 'quote_success', when = { action = 'quote' } }" },
      { id = "approval_required", label = "Approval Required", lua = "scenario { name = 'approval_required', given = { wallet = { connected = true } } }" },
      { id = "approve_success", label = "Approve Success", lua = "scenario { name = 'approve_success', when = { action = 'approve' } }" },
      { id = "transaction_pending", label = "Transaction Pending", lua = "scenario { name = 'transaction_pending', given = { chaos = { pendingForMs = 600000 } } }" },
      { id = "transaction_reverted", label = "Transaction Reverted", lua = "scenario { name = 'transaction_reverted', given = { chaos = { forceRevert = true } } }" },
      { id = "high_slippage", label = "High Slippage", lua = "scenario { name = 'high_slippage', given = { chaos = { slippagePctOverride = 12 } } }" },
    },
    paramsSchema = {
      { key = "chainId", label = "Chain", type = "chainId", required = true, default = 11155111, options = { 1, 11155111 } },
      { key = "tokenIn", label = "Token In", type = "address", required = true, default = "0xfff9976782d46cc05630d1f6ebab18b2324d6b14" },
      { key = "tokenOut", label = "Token Out", type = "address", required = true, default = "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238" },
    },
    recommendedControls = { "chainId", "tokenIn", "tokenOut" },
  },

  materialize = function(params)
    local chainId = tonumber(params.chainId or 11155111)
    local tokenIn = tostring(params.tokenIn or "0xfff9976782d46cc05630d1f6ebab18b2324d6b14")
    local tokenOut = tostring(params.tokenOut or "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238")
    local tokenInKey = string.lower(tokenIn)
    local tokenOutKey = string.lower(tokenOut)
    local router = "0x7a250d5630b4cf539739df2c5dacb4c659f2488d"
    local factory = "0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f"
    local pair = "0x1111111111111111111111111111111111112000"

    return {
      resolvedParams = { chainId = chainId, tokenIn = tokenIn, tokenOut = tokenOut },
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
        chain = { id = chainId },
        protocol = { id = "uniswap_v2", version = "v2", components = { router = "router_02", pricing = "pair_reserves" } },
        protocolRuntime = {
          activeProtocol = "uniswap_v2",
          supportLevel = "L3",
          chainId = chainId,
          contracts = { router = router, factory = factory, pair = pair },
          tokens = {
            [tokenInKey] = { symbol = "TOKEN_IN", decimals = 18 },
            [tokenOutKey] = { symbol = "TOKEN_OUT", decimals = 18 },
          },
          uniswapV2 = {
            router = router,
            factory = factory,
            pairs = {
              { address = pair, token0 = tokenIn, token1 = tokenOut, reserve0 = "100", reserve1 = "180000" },
            },
          },
        },
      },
      routeMocks = protocol_routes(),
    }
  end,
}
