-- 체인 상태 관리
local M = {}

function M.new(input)
  local value = input or {}
  return {
    id = value.id or "0x1",
    name = value.name or "Ethereum",
    blockNumber = value.blockNumber or 0,
    gasPrice = value.gasPrice or "0x0",
  }
end

return M
