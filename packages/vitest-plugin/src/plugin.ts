import { createLunaVitestRunner, type LunaVitestRunner, type LunaVitestRunnerOptions } from "./runner.js";

export type LunaVitestPluginOptions = LunaVitestRunnerOptions;

export type LunaVitestPlugin = LunaVitestRunner & {
  name: "lunatest-vitest-plugin";
  scenarioDir: string;
};

export function createLunaVitestPlugin(options: LunaVitestPluginOptions = {}): LunaVitestPlugin {
  return {
    name: "lunatest-vitest-plugin",
    scenarioDir: options.scenarioDir ?? "scenarios",
    ...createLunaVitestRunner(options),
  };
}
