export const sdkName = "@lunatest/core";

export { LunaProvider } from "./provider/luna-provider.js";
export type { LunaProviderOptions } from "./provider/luna-provider.js";
export { loadLunaConfig } from "./config/lua-config.js";
export {
  applyInterceptState,
  createScenarioRuntime,
  LuaConfigSchema,
  setRouteMocks,
  type LuaConfig,
  type RouteMock,
  type ScenarioRuntime,
} from "./runtime/scenario-runtime.js";
export {
  executeLuaScenario,
  type ExecuteLuaScenarioInput,
  type ExecuteLuaScenarioResult,
} from "./runner/execute-scenario.js";
