import { createScenarioRuntime, loadLunaConfig } from "@lunatest/core";

import { resolveScenarioSources } from "./scenario-sources.js";

export type ValidateCommandOptions = {
  scenario?: string;
  luaConfigPath: string;
};

export async function validateCommand(options: ValidateCommandOptions): Promise<string> {
  const sources = await resolveScenarioSources({
    scenario: options.scenario,
    luaConfigPath: options.luaConfigPath,
  });

  let passed = 0;
  let failed = 0;
  const lines: string[] = ["Validate Summary", `sources=${sources.length}`];

  for (const source of sources) {
    try {
      const config = await loadLunaConfig(source);
      createScenarioRuntime(config);
      passed += 1;
      lines.push(`PASS ${source}`);
    } catch (cause) {
      failed += 1;
      const message = cause instanceof Error ? cause.message : String(cause);
      lines.push(`FAIL ${source}`);
      lines.push(`reason=${message}`);
    }
  }

  lines.push(`passed=${passed}`);
  lines.push(`failed=${failed}`);

  return lines.join("\n");
}
