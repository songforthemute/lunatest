-- Virtual Clock 템플릿
local M = {}

function M.new(now)
  local clock = {
    now = now or 0,
    queue = {},
  }

  function clock.advance(deltaMs)
    clock.now = clock.now + deltaMs
    return clock.now
  end

  function clock.schedule(afterMs, event)
    table.insert(clock.queue, {
      atMs = clock.now + afterMs,
      payload = event,
    })
  end

  function clock.drainDue()
    local due = {}
    local pending = {}

    for _, item in ipairs(clock.queue) do
      if item.atMs <= clock.now then
        table.insert(due, item.payload)
      else
        table.insert(pending, item)
      end
    end

    clock.queue = pending
    return due
  end

  return clock
end

return M
