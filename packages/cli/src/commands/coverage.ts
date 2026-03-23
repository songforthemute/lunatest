import type { ResolvedLunaCliConfig } from "../config.js";
import { buildScenarioCoverageSnapshot, loadScenarioCatalog } from "../scenario-catalog.js";

export async function coverageCommand(config: ResolvedLunaCliConfig): Promise<string> {
  const catalog = await loadScenarioCatalog({ config, allowEmpty: true });
  const report = buildScenarioCoverageSnapshot({
    items: catalog,
    coverageCatalog: config.coverageCatalog,
  });

  return JSON.stringify(report, null, 2);
}
