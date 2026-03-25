import type { LuaEngine } from "wasmoon";

import type { RuntimeOptions } from "./types.js";

function createDeterministicRandom(seed: number): () => number {
  let cursor = seed;

  return () => {
    const nextValue = Math.sin(cursor++) * 10000;
    const fractional = nextValue - Math.floor(nextValue);
    return Number(fractional.toFixed(6));
  };
}

function toInteger(value: number): number {
  return Number.isFinite(value) ? Math.trunc(value) : 0;
}

export async function applySandbox(
  engine: LuaEngine,
  options: RuntimeOptions = {},
): Promise<void> {
  const seed = options.seed ?? 1;
  const now = toInteger(options.now ?? 0);
  const instructionLimit = options.instructionLimit;

  engine.global.set("__lunatest_next_random", createDeterministicRandom(seed));

  await engine.doString(`
    math.random = function()
      return __lunatest_next_random()
    end

    os.time = function()
      return ${now}
    end

    os.date = function()
      return "1970-01-01T00:00:00Z"
    end

    io = {
      open = function()
        error("io.open is blocked in sandbox")
      end
    }

    os.execute = function()
      error("os.execute is blocked in sandbox")
    end
  `);

  if (instructionLimit !== undefined) {
    const normalizedLimit = Math.max(1, toInteger(instructionLimit));

    await engine.doString(`
      __lunatest_instruction_count = 0
      __lunatest_instruction_limit = ${normalizedLimit}

      debug.sethook(function()
        __lunatest_instruction_count = __lunatest_instruction_count + 1
        if __lunatest_instruction_count > __lunatest_instruction_limit then
          error("instruction limit exceeded")
        end
      end, "", 1)
    `);
  }
}
