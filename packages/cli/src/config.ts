import {
  loadLunaProjectConfig,
  type LunaProjectConfig,
  type ResolvedLunaProjectConfig,
} from "@lunatest/core";

export type LunaCliConfig = LunaProjectConfig;
export type ResolvedLunaCliConfig = ResolvedLunaProjectConfig;

export async function loadConfig(cwd = process.cwd()): Promise<ResolvedLunaCliConfig> {
  return loadLunaProjectConfig({ cwd });
}
