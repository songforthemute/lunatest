import { createRuntime } from "../runtime/engine.js";
import { LuaConfigSchema, type LuaConfig } from "../runtime/scenario-runtime.js";
import { isRecord } from "@lunatest/contracts";

type LuaConfigSource = string | URL;

function seemsInlineLua(input: string): boolean {
  return input.includes("\n") || input.includes("scenario {") || input.includes("scenario{");
}

async function readSource(source: LuaConfigSource): Promise<string> {
  if (source instanceof URL) {
    if (source.protocol === "http:" || source.protocol === "https:") {
      if (typeof fetch !== "function") {
        throw new Error(`Fetch API is unavailable for URL source: ${source.toString()}`);
      }

      const response = await fetch(source);
      if (!response.ok) {
        throw new Error(`Failed to load Lua config: ${source.toString()} (${response.status})`);
      }

      return response.text();
    }

    if (source.protocol !== "file:") {
      throw new Error(`Unsupported Lua config URL protocol: ${source.protocol}`);
    }

    const [{ fileURLToPath }, { readFile }] = await Promise.all([
      import("node:url"),
      import("node:fs/promises"),
    ]);

    return readFile(fileURLToPath(source), "utf8");
  }

  if (seemsInlineLua(source)) {
    return source;
  }

  if (typeof document !== "undefined" && typeof fetch === "function") {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to load Lua config: ${source} (${response.status})`);
    }
    return response.text();
  }

  try {
    const { readFile } = await import("node:fs/promises");
    return await readFile(source, "utf8");
  } catch {
    return source;
  }
}

export async function loadLunaConfig(source: LuaConfigSource): Promise<LuaConfig> {
  const code = await readSource(source);
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
