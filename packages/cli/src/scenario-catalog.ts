import { readFile } from "node:fs/promises";

import {
  buildCoverageSnapshot,
  loadLunaConfig,
  resolveCoverageMetadata,
  type LuaConfig,
} from "@lunatest/core";
import type { CoverageCatalog, CoverageMetadata, CoverageSnapshot } from "@lunatest/contracts";

import type { ResolvedLunaCliConfig } from "./config.js";
import { resolveScenarioSources } from "./commands/scenario-sources.js";

export type ScenarioCatalogEntry = {
  id: string;
  name: string;
  source: string;
  lua: string;
  config: LuaConfig;
  coverage: CoverageMetadata;
};

function normalizeCoverage(metadata: CoverageMetadata): CoverageMetadata {
  return {
    features: metadata.features ? [...metadata.features] : undefined,
    states: metadata.states ? [...metadata.states] : undefined,
    components: metadata.components ? [...metadata.components] : undefined,
  };
}

function toScenarioId(source: string): string {
  return source.replace(/\\/g, "/").replace(/\.lua$/u, "");
}

export async function loadScenarioCatalog(input: {
  config: ResolvedLunaCliConfig;
  scenario?: string;
  allowEmpty?: boolean;
}): Promise<ScenarioCatalogEntry[]> {
  let sources: string[];
  try {
    sources = await resolveScenarioSources({
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

  return Promise.all(
    sources.map(async (source) => {
      const [lua, config] = await Promise.all([
        readFile(source, "utf8"),
        loadLunaConfig(source),
      ]);
      const resolvedCoverage = resolveCoverageMetadata(config);

      return {
        id: toScenarioId(source),
        name: config.name ?? source,
        source,
        lua,
        config,
        coverage: normalizeCoverage(resolvedCoverage),
      };
    }),
  );
}

export function buildScenarioCoverageSnapshot(input: {
  items: ScenarioCatalogEntry[];
  coverageCatalog?: Partial<CoverageCatalog>;
}): CoverageSnapshot {
  return buildCoverageSnapshot({
    items: input.items.map((item) => item.config),
    coverageCatalog: input.coverageCatalog,
  });
}
