export const sdkName = "@lunatest/core";

export { LunaProvider } from "./provider/luna-provider.js";
export type { LunaProviderOptions } from "./provider/luna-provider.js";
export { loadLunaConfig } from "./config/lua-config.js";
export {
  buildCoverageSnapshot,
  resolveCoverageMetadata,
} from "./coverage/catalog.js";
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
export { loadProjectPresetSources } from "./presets/project-sources.node.js";
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
