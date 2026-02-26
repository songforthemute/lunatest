import { executeLuaScenario } from "@lunatest/core";

import { resolveScenarioSources } from "./scenario-sources.js";

export type RunCommandOptions = {
  filter?: string;
  scenario?: string;
  luaConfigPath: string;
};

export async function runCommand(options: RunCommandOptions): Promise<string> {
  const sources = await resolveScenarioSources({
    scenario: options.scenario,
    luaConfigPath: options.luaConfigPath,
  });

  let passed = 0;
  let failed = 0;
  const lines: string[] = ["Scenario Summary", `sources=${sources.length}`];

  for (const source of sources) {
    const execution = await executeLuaScenario({
      source,
      adapter: {
        runWhen({ config, runtime }) {
          if (config.intercept?.routes) {
            runtime.setRouteMocks(config.intercept.routes);
          }

          if (config.given) {
            runtime.applyInterceptState(config.given);
          }

          if (config.intercept?.state) {
            runtime.applyInterceptState(config.intercept.state);
          }
        },
        resolveUi({ runtime }) {
          return runtime.getInterceptState();
        },
        resolveState({ runtime }) {
          return runtime.getInterceptState();
        },
      },
    });

    const targetName = execution.scenarioName;
    if (options.filter && !targetName.includes(options.filter)) {
      continue;
    }

    if (execution.pass) {
      passed += 1;
      lines.push(`PASS ${targetName} source=${source}`);
      continue;
    }

    failed += 1;
    lines.push(`FAIL ${targetName} source=${source}`);
    if (execution.error) {
      lines.push(`error=${execution.error}`);
    }
    if (execution.result?.diff) {
      lines.push(`diff=${execution.result.diff}`);
    }
  }

  lines.push(`filter=${options.filter ?? "all"}`);
  lines.push(`passed=${passed}`);
  lines.push(`failed=${failed}`);

  return lines.join("\n");
}
