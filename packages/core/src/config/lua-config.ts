import { createRuntime } from "../runtime/engine.js";
import { LuaConfigSchema, type LuaConfig } from "../runtime/scenario-runtime.js";
import { isRecord } from "@lunatest/contracts";
import { readLuaSource } from "./read-source.js";

type LuaConfigSource = string | URL;

export async function loadLunaConfig(source: LuaConfigSource): Promise<LuaConfig> {
  const code = await readLuaSource(source);
  const runtime = await createRuntime();
  let captured: unknown;

  runtime.register("scenario", (table: unknown) => {
    captured = table;
    return table;
  });

  runtime.register("lunatest", (table: unknown) => {
    captured = table;
    return table;
  });

  await runtime.eval(code);

  if (captured === undefined) {
    const snapshot = await runtime.getState(["__lunatest_config"]);
    captured = snapshot.__lunatest_config;
  }

  if (captured === undefined || captured === null) {
    throw new Error("Lua config must declare scenario { ... } or lunatest({ ... })");
  }

  const parsed = LuaConfigSchema.parse(captured);

  if (!isRecord(parsed.given)) {
    throw new Error("Lua config given must be a table");
  }

  return parsed;
}
