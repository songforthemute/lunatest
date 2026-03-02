-- Uniswap V2 상태 템플릿
local M = {}

function M.pool()
  return {
    kind = "uniswap_v2",
    feeBps = 30,
    token0 = "ETH",
    token1 = "USDC",
    reserve0 = "100",
    reserve1 = "180000",
  }
end

return M
