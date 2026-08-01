import { loadLunaProjectConfigSync } from "@lunatest/core";

import { createLunaVitestRunner, type LunaVitestRunner, type LunaVitestRunnerOptions } from "./runner.js";

export type LunaVitestPluginOptions = LunaVitestRunnerOptions;

export type LunaVitestPlugin = LunaVitestRunner & {
  name: "lunatest-vitest-plugin";
  scenarioDir: string;
};

export function createLunaVitestPlugin(options: LunaVitestPluginOptions = {}): LunaVitestPlugin {
  const project = loadLunaProjectConfigSync(options);

  return {
    name: "lunatest-vitest-plugin",
    scenarioDir: options.scenarioDir ?? project.scenarioDir,
    ...createLunaVitestRunner(options),
  };
}
