import { constants as fsConstants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { relative } from "node:path";

import type { CoverageMetadata } from "@lunatest/contracts";
import { glob } from "tinyglobby";

import { loadLunaConfig } from "../config/lua-config.js";
import { resolveCoverageMetadata } from "../coverage/catalog.js";
import type { LuaConfig } from "../runtime/scenario-runtime.js";
import type { ResolvedLunaProjectConfig } from "./config.node.js";

const GLOB_CHARS = /[*?[\]{}]/;

export type ResolveLunaScenarioSourcesInput = {
  scenario?: string;
  luaConfigPath: string;
  scenarioDir: string;
};

export type LoadLunaProjectScenariosInput = {
  config: ResolvedLunaProjectConfig;
  scenario?: string;
  allowEmpty?: boolean;
};

export type LoadLunaProjectScenarioByIdInput = {
  config: ResolvedLunaProjectConfig;
  scenarioId: string;
};

export type LunaProjectScenario = {
  id: string;
  name: string;
  source: string;
  lua: string;
  config: LuaConfig;
  coverage: CoverageMetadata;
};

async function canAccess(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function normalizeSources(sources: Iterable<string>): string[] {
  return Array.from(new Set(sources)).sort();
}

export async function resolveLunaScenarioSources(
  input: ResolveLunaScenarioSourcesInput,
): Promise<string[]> {
  const target = input.scenario?.trim();
  if (!target) {
    const discovered = new Set<string>();

    if (await canAccess(input.luaConfigPath)) {
      discovered.add(input.luaConfigPath);
    }

    if (await canAccess(input.scenarioDir)) {
      const matched = await glob(`${input.scenarioDir.replace(/\\/g, "/")}/**/*.lua`, {
        absolute: true,
        onlyFiles: true,
      });

      for (const item of matched) {
        discovered.add(item);
      }
    }

    if (discovered.size === 0) {
      throw new Error(`Scenario source not found: ${input.luaConfigPath}`);
    }

    return normalizeSources(discovered);
  }

  if (!GLOB_CHARS.test(target)) {
    if (!(await canAccess(target))) {
      throw new Error(`Scenario source not found: ${target}`);
    }

    return [target];
  }

  const matched = await glob(target, {
    onlyFiles: true,
  });

  if (matched.length === 0) {
    throw new Error(`Scenario glob matched no files: ${target}`);
  }

  return normalizeSources(matched);
}

function toScenarioId(projectRoot: string, source: string): string {
  return relative(projectRoot, source).replace(/\\/g, "/").replace(/\.lua$/u, "");
}

function cloneCoverage(coverage: CoverageMetadata): CoverageMetadata {
  return {
    features: coverage.features ? [...coverage.features] : undefined,
    states: coverage.states ? [...coverage.states] : undefined,
    components: coverage.components ? [...coverage.components] : undefined,
  };
}

async function loadLunaProjectScenarioSource(
  config: ResolvedLunaProjectConfig,
  source: string,
): Promise<LunaProjectScenario> {
  const [lua, parsedConfig] = await Promise.all([readFile(source, "utf8"), loadLunaConfig(source)]);

  return {
    id: toScenarioId(config.projectRoot, source),
    name: parsedConfig.name ?? source,
    source,
    lua,
    config: parsedConfig,
    coverage: cloneCoverage(resolveCoverageMetadata(parsedConfig)),
  };
}

export async function loadLunaProjectScenarioById(
  input: LoadLunaProjectScenarioByIdInput,
): Promise<LunaProjectScenario | undefined> {
  const sources = await resolveLunaScenarioSources({
    luaConfigPath: input.config.resolvedLuaConfigPath,
    scenarioDir: input.config.resolvedScenarioDir,
  });
  const source = sources.find(
    (candidate) => toScenarioId(input.config.projectRoot, candidate) === input.scenarioId,
  );

  return source ? loadLunaProjectScenarioSource(input.config, source) : undefined;
}

export async function loadLunaProjectScenarios(
  input: LoadLunaProjectScenariosInput,
): Promise<LunaProjectScenario[]> {
  let sources: string[];
  try {
    sources = await resolveLunaScenarioSources({
      scenario: input.scenario,
      luaConfigPath: input.config.resolvedLuaConfigPath,
      scenarioDir: input.config.resolvedScenarioDir,
    });
  } catch (error) {
    if (
      input.allowEmpty &&
      error instanceof Error &&
      error.message.includes("Scenario source not found")
    ) {
      return [];
    }

    throw error;
  }

  return Promise.all(sources.map((source) => loadLunaProjectScenarioSource(input.config, source)));
}
