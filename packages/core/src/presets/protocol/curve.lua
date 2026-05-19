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
    id = "curve",
    label = "Curve",
    description = "Built-in stable swap preset.",
    kind = "dex",
    supportedChains = { 1 },
    protocol = "curve",
    version = "v1",
    components = { invariant = "stable_swap", router = "pool_router" },
    defaultWalletPreset = { id = "empty_wallet" },
    defaultInterceptState = { protocol = { id = "curve" } },
    defaultRouteMocks = protocol_routes(),
    builtinScenarios = {
      { id = "quote_success", label = "Quote Success", lua = "scenario { name = 'quote_success', when = { action = 'quote' } }" },
      { id = "approval_required", label = "Approval Required", lua = "scenario { name = 'approval_required', given = { wallet = { connected = true } } }" },
      { id = "approve_success", label = "Approve Success", lua = "scenario { name = 'approve_success', when = { action = 'approve' } }" },
      { id = "transaction_pending", label = "Transaction Pending", lua = "scenario { name = 'transaction_pending', given = { chaos = { pendingForMs = 600000 } } }" },
      { id = "transaction_reverted", label = "Transaction Reverted", lua = "scenario { name = 'transaction_reverted', given = { chaos = { forceRevert = true } } }" },
      { id = "imbalanced_pool", label = "Imbalanced Pool", lua = "scenario { name = 'imbalanced_pool', given = { pool = { imbalance = true } } }" },
    },
    paramsSchema = {
      { key = "chainId", label = "Chain", type = "chainId", required = true, default = 1, options = { 1 } },
      { key = "poolName", label = "Pool", type = "string", required = true, default = "3pool" },
    },
    recommendedControls = { "poolName" },
  },

  materialize = function(params)
    local chainId = tonumber(params.chainId or 1)
    local poolName = tostring(params.poolName or "3pool")
    local dai = "0x6b175474e89094c44da98b954eedeac495271d0f"
    local usdc = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
    local router = "0x1111111111111111111111111111111111114000"
    local pool = "0x1111111111111111111111111111111111114001"

    return {
      resolvedParams = { chainId = chainId, poolName = poolName },
      walletPreset = { id = "empty_wallet", overrides = { chainId = string.format("0x%x", chainId) } },
      walletSessionOverrides = {
        enabled = true,
        assets = {
          nativeBalance = "1000000000000000000",
          tokens = {
            [string.lower(dai)] = { balance = "1000", allowance = "0", symbol = "DAI", decimals = 18 },
            [string.lower(usdc)] = { balance = "0", allowance = "0", symbol = "USDC", decimals = 6 },
          },
        },
      },
      interceptState = {
        chain = { id = chainId },
        protocol = { id = "curve", version = "v1", components = { invariant = "stable_swap", router = "pool_router" } },
        protocolRuntime = {
          activeProtocol = "curve",
          supportLevel = "L3",
          chainId = chainId,
          contracts = { router = router, pool = pool },
          tokens = {
            [string.lower(dai)] = { symbol = "DAI", decimals = 18 },
            [string.lower(usdc)] = { symbol = "USDC", decimals = 6 },
          },
          curve = {
            router = router,
            pools = {
              { name = poolName, address = pool, coins = { dai, usdc }, balances = { "1000000", "1000000" }, feeBps = 4, virtualPrice = "1000000000000000000" },
            },
          },
        },
      },
      routeMocks = protocol_routes(),
    }
  end,
}
