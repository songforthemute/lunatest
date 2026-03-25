scenario {
  name = "default-devtools-scenario",
  mode = "strict",

  given = {
    chain = { id = 1, gasPrice = 30 },
    wallet = { connected = true, balances = { ETH = 10.0 } },
  },

  intercept = {
    routes = {
      { endpointType = "ethereum", method = "eth_chainId", responseKey = "wallet.chainId" },
      { endpointType = "ethereum", method = "eth_accounts", responseKey = "wallet.accounts" },
      { endpointType = "rpc", urlPattern = "**/rpc", methods = { "eth_call" }, responseKey = "rpc.call" },
      { endpointType = "http", urlPattern = "**/api/quote", method = "GET", responseKey = "api.quote" },
    },
    mockResponses = {
      ["wallet.chainId"] = { result = "0x1" },
      ["wallet.accounts"] = { result = { "0x1111111111111111111111111111111111111111" } },
      ["rpc.call"] = { result = "0x01" },
      ["api.quote"] = {
        status = 200,
        body = { amountOut = "123.45", priceImpactBps = 12 },
      },
    },
    state = {
      chain = { blockNumber = 19000000 },
    },
  },
}
