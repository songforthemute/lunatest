-- Uniswap V3 상태 템플릿
local M = {}

function M.pool()
  return {
    kind = "uniswap_v3",
    feeBps = 5,
    token0 = "ETH",
    token1 = "USDC",
    tickSpacing = 60,
    liquidity = "1000000",
  }
end

return M
