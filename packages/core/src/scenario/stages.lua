-- Stage Machine 템플릿
local M = {}

function M.new(stages)
  local machine = {
    stages = stages or {},
    index = 1,
  }

  function machine.current()
    return machine.stages[machine.index]
  end

  function machine.next()
    if machine.index < #machine.stages then
      machine.index = machine.index + 1
    end
    return machine.current()
  end

  function machine.done()
    return machine.index >= #machine.stages
  end

  return machine
end

return M
