-- 지갑 상태 관리
local M = {}

function M.new(input)
  local value = input or {}
  return {
    connected = value.connected ~= false,
    address = value.address,
    balances = value.balances or {},
    allowances = value.allowances or {},
    chainId = value.chainId or "0x1",
  }
end

function M.approve(wallet, token, amount)
  wallet.allowances[token] = amount
  return wallet
end

return M
