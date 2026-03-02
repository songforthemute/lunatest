export type LunaVitestPluginOptions = {
  scenarioDir?: string;
};

export function createLunaVitestPlugin(options: LunaVitestPluginOptions = {}) {
  return {
    name: "lunatest-vitest-plugin",
    scenarioDir: options.scenarioDir ?? "scenarios",
  };
}
