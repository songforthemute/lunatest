import { asRecord, type RouteMock } from "@lunatest/contracts";

import { readLuaSource } from "../config/read-source.js";
import { createRuntime } from "../runtime/engine.js";

type LuaPresetModule = {
  manifest: unknown;
  materialize: (params?: Record<string, unknown>) => Promise<unknown>;
};

function createPresetBootstrap(code: string): string {
  return `
local __preset_module = (function()
${code}
end)()
__lunatest_preset_manifest = __preset_module.manifest
__lunatest_preset_materialize = __preset_module.materialize
`;
}

export async function loadLuaPresetModule(source: string | URL): Promise<LuaPresetModule> {
  const runtime = await createRuntime();
  const code = await readLuaSource(source);

  await runtime.eval(createPresetBootstrap(code));

  const snapshot = await runtime.getState(["__lunatest_preset_manifest"]);
  const manifest = snapshot.__lunatest_preset_manifest;

  if (!asRecord(manifest)) {
    throw new Error("Lua preset must expose manifest table");
  }

  return {
    manifest,
    async materialize(params: Record<string, unknown> = {}) {
      const result = await runtime.call("__lunatest_preset_materialize", {
        params,
      });

      if (!asRecord(result)) {
        throw new Error("Lua preset materialize() must return a table");
      }

      const normalizedResult = result as Record<string, unknown>;

      if (Array.isArray((result as { routeMocks?: unknown }).routeMocks)) {
        const routeMocks = (result as { routeMocks: unknown[] }).routeMocks.filter(
          (route): route is RouteMock => asRecord(route) !== null,
        );
        return {
          ...normalizedResult,
          routeMocks,
        };
      }

      return normalizedResult;
    },
  };
}
