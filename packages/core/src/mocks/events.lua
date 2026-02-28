-- 이벤트 큐 관리
local M = {}

function M.new()
  return {
    now = 0,
    queue = {},
  }
end

function M.push(state, event)
  table.insert(state.queue, event)
  table.sort(state.queue, function(left, right)
    return left.atMs < right.atMs
  end)
end

function M.advance(state, deltaMs)
  state.now = state.now + deltaMs
  local ready = {}
  local pending = {}

  for _, event in ipairs(state.queue) do
    if event.atMs <= state.now then
      table.insert(ready, event)
    else
      table.insert(pending, event)
    end
  end

  state.queue = pending
  return ready
end

return M
