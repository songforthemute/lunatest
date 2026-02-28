-- Scenario DSL 템플릿
local M = {}

function M.scenario(def)
  if def.given == nil then
    error("given is required")
  end
  if def.when == nil or def.when.action == nil then
    error("when.action is required")
  end
  if def.then_ui == nil then
    error("then_ui is required")
  end
  return def
end

return M
