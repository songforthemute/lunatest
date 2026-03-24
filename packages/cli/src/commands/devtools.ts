import path from "node:path";

import type { ResolvedLunaCliConfig } from "../config.js";

export type DevtoolsCommandOptions = {
  open: boolean;
  config: ResolvedLunaCliConfig;
};

export function devtoolsCommand(options: DevtoolsCommandOptions): string {
  if (!options.open) {
    return "devtools command requires --open";
  }

  return [
    "Devtools",
    "status=ready",
    `config_path=${options.config.configPath ?? "default"}`,
    `lua_config_path=${options.config.resolvedLuaConfigPath}`,
    `scenario_dir=${options.config.resolvedScenarioDir}`,
    `local_preset_dir=${path.join(options.config.cwd, "lunatest", "presets")}`,
    "browser_entry=@lunatest/react/browser",
    "bootstrap_api=bootstrapLunaRuntime()",
    "widget=LunaDevtoolsPanel",
    "mount_api=mountLunaDevtools()",
    `guide=bootstrapLunaRuntime({ source: \"./${options.config.luaConfigPath}\", nodeEnv, mountDevtools: true })`,
  ].join("\n");
}
