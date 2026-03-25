export const sdkName = "@lunatest/core/browser";

export { loadLunaConfig } from "./config/lua-config.js";
export {
  createPresetRegistry,
  getProtocolPreset,
  getPresetDiagnostics,
  getWalletPreset,
  listProtocolPresets,
  listWalletPresets,
  validateProtocolPresetSource,
  validateWalletPresetSource,
  materializeProtocolPreset,
  materializeWalletPreset,
} from "./presets/registry.js";
export type { PresetRegistry, PresetRegistryOptions, ProjectPresetSources } from "./presets/registry.js";
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
