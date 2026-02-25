import { mutateScenarioVariants } from "../generation/mutator";

export type ScenarioDescriptor = {
  id: string;
  name: string;
  lua?: string;
  tags?: string[];
};

type ScenarioCreateInput = {
  id: string;
  name: string;
  lua?: string;
  tags?: string[];
};

type ScenarioMutateInput = {
  id: string;
  count?: number;
};

export type ScenarioTools = {
  list: () => Promise<ScenarioDescriptor[]>;
  get: (id: string) => Promise<ScenarioDescriptor | null>;
  create: (input: ScenarioCreateInput) => Promise<ScenarioDescriptor>;
  run: (id: string) => Promise<{ id: string; pass: boolean }>;
  runAll: (filter?: string) => Promise<Array<{ id: string; pass: boolean }>>;
  mutate: (input: ScenarioMutateInput) => Promise<ScenarioDescriptor[]>;
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

    async runAll(filter) {
      const candidates = Array.from(store.values()).filter((scenario) => {
        if (!filter) {
          return true;
        }
        return scenario.id.includes(filter) || scenario.name.includes(filter);
      });

      return candidates.map((item) => ({
        id: item.id,
        pass: true,
      }));
    },

    async mutate(input) {
      const source = store.get(input.id);
      if (!source) {
        throw new Error(`Scenario not found: ${input.id}`);
      }

      const count = Math.max(1, Math.trunc(input.count ?? 1));
      const variants = mutateScenarioVariants(source, count);
      for (const variant of variants) {
        store.set(variant.id, variant);
      }

      return variants;
    },
  };
}
