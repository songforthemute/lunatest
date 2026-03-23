import { executeLuaScenario } from "@lunatest/core";
import { readFile } from "node:fs/promises";
import type { ResolvedLunaCliConfig } from "../config.js";
import { resolveScenarioSources } from "./scenario-sources.js";

export type RunCommandOptions = {
  filter?: string;
  scenario?: string;
  config: ResolvedLunaCliConfig;
};

export async function runCommand(options: RunCommandOptions): Promise<string> {
  const sources = await resolveScenarioSources({
    scenario: options.scenario,
    luaConfigPath: options.config.resolvedLuaConfigPath,
    scenarioDir: options.config.resolvedScenarioDir,
  });
  const filteredSources = options.filter
    ? await (async () => {
        const matched: string[] = [];

        for (const source of sources) {
          const scenarioName = await readScenarioName(source);
          if (scenarioName.includes(options.filter!)) {
            matched.push(source);
          }
        }

        return matched;
      })()
    : sources;

  let passed = 0;
  let failed = 0;
  const lines: string[] = ["Scenario Summary", `sources=${filteredSources.length}`];

  for (const source of filteredSources) {
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

async function readScenarioName(source: string): Promise<string> {
  const code = await readFile(source, "utf8");
  const matched = code.match(/name\s*=\s*["']([^"']+)["']/u);
  return matched?.[1] ?? source;
}
