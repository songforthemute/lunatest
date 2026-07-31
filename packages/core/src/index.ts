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
  loadLunaProjectConfig,
  type LoadLunaProjectConfigOptions,
  type LunaProjectConfig,
  type ResolvedLunaProjectConfig,
} from "./project/config.node.js";
export {
  loadLunaProjectScenarios,
  resolveLunaScenarioSources,
  type LoadLunaProjectScenariosInput,
  type LunaProjectScenario,
  type ResolveLunaScenarioSourcesInput,
} from "./project/scenarios.node.js";
export {
  listLunaProjectScenarios,
  runAllLunaProjectScenarios,
  runLunaProjectScenario,
  LunaProjectScenarioNotFoundError,
  type LunaProjectRunnerOptions,
  type LunaProjectScenarioExecution,
  type RunAllLunaProjectScenariosOptions,
  type RunLunaProjectScenarioOptions,
} from "./project/runner.node.js";
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
  createDeterministicScenarioAdapter,
  executeLuaScenario,
  type ExecuteLuaScenarioAdapter,
  type ExecuteLuaScenarioInput,
  type ExecuteLuaScenarioResult,
} from "./runner/execute-scenario.js";
