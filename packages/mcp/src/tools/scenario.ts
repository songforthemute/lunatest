export type ScenarioDescriptor = {
  id: string;
  name: string;
  lua?: string;
};

type ScenarioCreateInput = {
  id: string;
  name: string;
  lua?: string;
};

export type ScenarioTools = {
  list: () => Promise<ScenarioDescriptor[]>;
  get: (id: string) => Promise<ScenarioDescriptor | null>;
  create: (input: ScenarioCreateInput) => Promise<ScenarioDescriptor>;
  run: (id: string) => Promise<{ id: string; pass: boolean }>;
};

export function createScenarioTools(seed: ScenarioDescriptor[]): ScenarioTools {
  const store = new Map(seed.map((item) => [item.id, { ...item }]));

  return {
    async list() {
      return Array.from(store.values());
    },

    async get(id) {
      return store.get(id) ?? null;
    },

    async create(input) {
      const next = { ...input };
      store.set(next.id, next);
      return next;
    },

    async run(id) {
      if (!store.has(id)) {
        throw new Error(`Scenario not found: ${id}`);
      }

      return {
        id,
        pass: true,
      };
    },
  };
}
