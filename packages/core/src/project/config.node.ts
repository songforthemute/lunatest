import { constants as fsConstants, existsSync, readFileSync } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { CoverageCatalog } from "@lunatest/contracts";

export type LunaProjectConfig = {
  scenarioDir: string;
  luaConfigPath: string;
  coverageCatalog?: Partial<CoverageCatalog>;
  ai?: {
    command: string;
    args?: string[];
    env?: Record<string, string>;
  };
};

export type ResolvedLunaProjectConfig = LunaProjectConfig & {
  config: LunaProjectConfig;
  cwd: string;
  projectRoot: string;
  configPath: string | null;
  resolvedScenarioDir: string;
  resolvedLuaConfigPath: string;
};

export type LoadLunaProjectConfigOptions = {
  cwd?: string;
  configPath?: string;
  requireConfig?: boolean;
};

const DEFAULT_CONFIG: LunaProjectConfig = {
  scenarioDir: "scenarios",
  luaConfigPath: "lunatest.lua",
};

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

function normalizeAiConfig(value: unknown): LunaProjectConfig["ai"] | undefined {
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

function normalizeConfig(input: unknown): LunaProjectConfig {
  if (!isRecord(input)) {
    return { ...DEFAULT_CONFIG };
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

async function canAccess(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

type LunaProjectConfigLocation = {
  cwd: string;
  selectedConfigPath: string;
};

function resolveConfigLocation(options: LoadLunaProjectConfigOptions): LunaProjectConfigLocation {
  const cwd = resolve(options.cwd ?? process.cwd());
  const selectedConfigPath = resolve(cwd, options.configPath ?? "lunatest.config.json");

  return { cwd, selectedConfigPath };
}

function createResolvedConfig(
  cwd: string,
  configPath: string | null,
  config: LunaProjectConfig,
): ResolvedLunaProjectConfig {
  const projectRoot = configPath ? dirname(configPath) : cwd;

  return {
    ...config,
    config,
    cwd,
    projectRoot,
    configPath,
    resolvedScenarioDir: resolve(projectRoot, config.scenarioDir),
    resolvedLuaConfigPath: resolve(projectRoot, config.luaConfigPath),
  };
}

function resolveMissingConfig(
  options: LoadLunaProjectConfigOptions,
  location: LunaProjectConfigLocation,
): ResolvedLunaProjectConfig {
  if (options.configPath) {
    throw new Error(`Selected LunaTest config not found: ${location.selectedConfigPath}`);
  }

  if (options.requireConfig) {
    throw new Error(`Required LunaTest config not found: ${location.selectedConfigPath}`);
  }

  return createResolvedConfig(location.cwd, null, { ...DEFAULT_CONFIG });
}

function resolveConfig(
  location: LunaProjectConfigLocation,
  rawConfig: string,
): ResolvedLunaProjectConfig {
  try {
    return createResolvedConfig(
      location.cwd,
      location.selectedConfigPath,
      normalizeConfig(JSON.parse(rawConfig)),
    );
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new Error(
      `Unable to parse LunaTest config ${location.selectedConfigPath}: ${reason}`,
    );
  }
}

export async function loadLunaProjectConfig(
  options: LoadLunaProjectConfigOptions = {},
): Promise<ResolvedLunaProjectConfig> {
  const location = resolveConfigLocation(options);
  const hasConfigFile = await canAccess(location.selectedConfigPath);

  if (!hasConfigFile) {
    return resolveMissingConfig(options, location);
  }

  try {
    return resolveConfig(location, await readFile(location.selectedConfigPath, "utf8"));
  } catch (cause) {
    if (cause instanceof Error && cause.message.startsWith("Unable to parse LunaTest config")) {
      throw cause;
    }

    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`Unable to parse LunaTest config ${location.selectedConfigPath}: ${reason}`);
  }
}

export function loadLunaProjectConfigSync(
  options: LoadLunaProjectConfigOptions = {},
): ResolvedLunaProjectConfig {
  const location = resolveConfigLocation(options);

  if (!existsSync(location.selectedConfigPath)) {
    return resolveMissingConfig(options, location);
  }

  try {
    return resolveConfig(location, readFileSync(location.selectedConfigPath, "utf8"));
  } catch (cause) {
    if (cause instanceof Error && cause.message.startsWith("Unable to parse LunaTest config")) {
      throw cause;
    }

    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`Unable to parse LunaTest config ${location.selectedConfigPath}: ${reason}`);
  }
}
