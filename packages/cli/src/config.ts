export type LunaCliConfig = {
  scenarioDir: string;
  luaConfigPath: string;
};

export function loadConfig(): LunaCliConfig {
  return {
    scenarioDir: "scenarios",
    luaConfigPath: "lunatest.lua",
  };
}
