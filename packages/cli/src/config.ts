import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { resolve } from "node:path";
import type { CoverageCatalog } from "@lunatest/contracts";

export type LunaCliConfig = {
  scenarioDir: string;
  luaConfigPath: string;
  coverageCatalog?: Partial<CoverageCatalog>;
  ai?: {
    command: string;
    args?: string[];
    env?: Record<string, string>;
  };
};

export type ResolvedLunaCliConfig = LunaCliConfig & {
  cwd: string;
  configPath: string | null;
  resolvedScenarioDir: string;
  resolvedLuaConfigPath: string;
};

const DEFAULT_CONFIG: LunaCliConfig = {
  scenarioDir: "scenarios",
  luaConfigPath: "lunatest.lua",
};

async function canAccess(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeCoverageCatalog(value: unknown): Partial<CoverageCatalog> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const readList = (field: unknown): string[] | undefined => {
    if (!Array.isArray(field)) {
      return undefined;
    }

    return field.filter((item): item is string => typeof item === "string" && item.length > 0);
  };

  return {
    features: readList(value.features),
    states: readList(value.states),
    components: readList(value.components),
  };
}

function normalizeAiConfig(value: unknown): LunaCliConfig["ai"] | undefined {
  if (!isRecord(value) || typeof value.command !== "string" || value.command.length === 0) {
    return undefined;
  }

  return {
    command: value.command,
    args: Array.isArray(value.args)
      ? value.args.filter((item): item is string => typeof item === "string")
      : undefined,
    env: isRecord(value.env)
      ? Object.fromEntries(
          Object.entries(value.env).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        )
      : undefined,
  };
}

function normalizeConfig(input: unknown): LunaCliConfig {
  if (!isRecord(input)) {
    return DEFAULT_CONFIG;
  }

  return {
    scenarioDir:
      typeof input.scenarioDir === "string" && input.scenarioDir.length > 0
        ? input.scenarioDir
        : DEFAULT_CONFIG.scenarioDir,
    luaConfigPath:
      typeof input.luaConfigPath === "string" && input.luaConfigPath.length > 0
        ? input.luaConfigPath
        : DEFAULT_CONFIG.luaConfigPath,
    coverageCatalog: normalizeCoverageCatalog(input.coverageCatalog),
    ai: normalizeAiConfig(input.ai),
  };
}

export async function loadConfig(cwd = process.cwd()): Promise<ResolvedLunaCliConfig> {
  const configPath = resolve(cwd, "lunatest.config.json");
  const hasConfigFile = await canAccess(configPath);
  const raw = hasConfigFile
    ? normalizeConfig(JSON.parse(await readFile(configPath, "utf8")))
    : DEFAULT_CONFIG;

  return {
    ...raw,
    cwd,
    configPath: hasConfigFile ? configPath : null,
    resolvedScenarioDir: resolve(cwd, raw.scenarioDir),
    resolvedLuaConfigPath: resolve(cwd, raw.luaConfigPath),
  };
}
