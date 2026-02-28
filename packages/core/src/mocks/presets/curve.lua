-- Curve 상태 템플릿
local M = {}

function M.pool()
  return {
    kind = "curve",
    amplification = 100,
    tokens = { "USDC", "USDT", "DAI" },
    balances = { "1000000", "1000000", "1000000" },
  }
end

return M
