import { isLunaRuntimeInterceptEnabled, resolveEnabled } from "@lunatest/runtime-intercept";
import type { ResolvedLunaCliConfig } from "../config.js";

export function doctorCommand(config: ResolvedLunaCliConfig, nodeEnv = process.env.NODE_ENV): string {
  const enabled = isLunaRuntimeInterceptEnabled();
  const guard = resolveEnabled({ enable: undefined }, nodeEnv) ? "pass" : "blocked";
  const scenarioSource =
    config.configPath ?? `${config.resolvedLuaConfigPath} (default)`;

  return [
    "Doctor",
    `node_env=${nodeEnv ?? "undefined"}`,
    `config_path=${config.configPath ?? "default"}`,
    `lua_config_path=${config.resolvedLuaConfigPath}`,
    `scenario_dir=${config.resolvedScenarioDir}`,
    `runtime_intercept=${enabled ? "enabled" : "disabled"}`,
    `guard=${guard}`,
    `ai_adapter=${config.ai?.command ?? "unconfigured"}`,
    `scenario_source=${scenarioSource}`,
  ].join("\n");
}
