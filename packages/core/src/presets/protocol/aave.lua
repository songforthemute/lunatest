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
    id = "aave",
    label = "Aave",
    description = "Built-in lending market preset.",
    kind = "lending",
    supportedChains = { 1 },
    protocol = "aave",
    version = "v3",
    components = { pool = "v3_pool", oracle = "price_oracle" },
    defaultWalletPreset = { id = "empty_wallet" },
    defaultInterceptState = { protocol = { id = "aave" } },
    defaultRouteMocks = protocol_routes(),
    builtinScenarios = {
      { id = "quote_success", label = "Market Read Success", lua = "scenario { name = 'quote_success', when = { action = 'read_market' } }" },
      { id = "approval_required", label = "Approval Required", lua = "scenario { name = 'approval_required', given = { wallet = { connected = true } } }" },
      { id = "approve_success", label = "Approve Success", lua = "scenario { name = 'approve_success', when = { action = 'approve' } }" },
      { id = "transaction_pending", label = "Transaction Pending", lua = "scenario { name = 'transaction_pending', given = { chaos = { pendingForMs = 600000 } } }" },
      { id = "transaction_reverted", label = "Transaction Reverted", lua = "scenario { name = 'transaction_reverted', given = { chaos = { forceRevert = true } } }" },
      { id = "health_factor_warning", label = "Health Factor Warning", lua = "scenario { name = 'health_factor_warning', given = { wallet = { healthFactor = 1.02 } } }" },
    },
    paramsSchema = {
      { key = "chainId", label = "Chain", type = "chainId", required = true, default = 1, options = { 1 } },
      { key = "reserve", label = "Reserve", type = "string", required = true, default = "USDC" },
    },
    recommendedControls = { "reserve" },
  },

  materialize = function(params)
    local chainId = tonumber(params.chainId or 1)
    local reserve = tostring(params.reserve or "USDC")
    local usdc = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
    local pool = "0x1111111111111111111111111111111111115000"
    local oracle = "0x1111111111111111111111111111111111115001"

    return {
      resolvedParams = { chainId = chainId, reserve = reserve },
      walletPreset = { id = "empty_wallet", overrides = { chainId = string.format("0x%x", chainId) } },
      walletSessionOverrides = {
        enabled = true,
        assets = {
          nativeBalance = "1000000000000000000",
          tokens = {
            [string.lower(usdc)] = { balance = "1000", allowance = "0", symbol = reserve, decimals = 6 },
          },
        },
      },
      interceptState = {
        chain = { id = chainId },
        protocol = { id = "aave", version = "v3", components = { pool = "v3_pool", oracle = "price_oracle" } },
        protocolRuntime = {
          activeProtocol = "aave",
          supportLevel = "L3",
          chainId = chainId,
          contracts = { pool = pool, oracle = oracle },
          tokens = {
            [string.lower(usdc)] = { symbol = reserve, decimals = 6 },
          },
          aave = {
            pool = pool,
            oracle = oracle,
            reserves = {
              { asset = usdc, symbol = reserve, price = "100000000", ltvBps = 8000, liquidationThresholdBps = 8250 },
            },
            positions = {},
          },
        },
      },
      routeMocks = protocol_routes(),
    }
  end,
}
