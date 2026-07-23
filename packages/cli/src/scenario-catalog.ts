import {
  buildCoverageSnapshot,
  loadLunaProjectScenarios,
  type LunaProjectScenario,
} from "@lunatest/core";
import type { CoverageCatalog, CoverageSnapshot } from "@lunatest/contracts";

import type { ResolvedLunaCliConfig } from "./config.js";

export type ScenarioCatalogEntry = LunaProjectScenario;

function toScenarioId(source: string): string {
  return source.replace(/\\/g, "/").replace(/\.lua$/u, "");
}

export async function loadScenarioCatalog(input: {
  config: ResolvedLunaCliConfig;
  scenario?: string;
  allowEmpty?: boolean;
}): Promise<ScenarioCatalogEntry[]> {
  const scenarios = await loadLunaProjectScenarios(input);

  return scenarios.map((scenario) => ({
    ...scenario,
    // 생성 프롬프트의 기존 source 기반 ID 계약을 유지한다.
    id: toScenarioId(scenario.source),
  }));
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
