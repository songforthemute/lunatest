export type LunaCliConfig = {
  scenarioDir: string;
};

export function loadConfig(): LunaCliConfig {
  return {
    scenarioDir: "scenarios",
  };
}
