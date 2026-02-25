-- Stage Machine 템플릿
local M = {}

function M.new(stages)
  return {
    stages = stages or {},
    index = 1,
  }
end

return M
