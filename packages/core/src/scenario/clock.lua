-- Virtual Clock 템플릿
local M = {}

function M.new(now)
  return {
    now = now or 0,
  }
end

return M
