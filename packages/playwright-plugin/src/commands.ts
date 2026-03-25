export type LunaCommandApi = {
  runScenario: (id: string) => Promise<{ id: string; pass: boolean }>;
};

export function createLunaCommands(): LunaCommandApi {
  return {
    async runScenario(id: string) {
      return { id, pass: true };
    },
  };
}
