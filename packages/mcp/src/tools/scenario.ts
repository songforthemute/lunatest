import { mutateScenarioVariants } from "../generation/mutator.js";
import { executeLuaScenario, type ExecuteLuaScenarioInput } from "@lunatest/core";

export type ScenarioDescriptor = {
  id: string;
  name: string;
  lua?: string;
  tags?: string[];
};

type ScenarioCreateInput = {
  id?: string;
  name?: string;
  lua?: string;
  tags?: string[];
};

type ScenarioMutateInput = {
  id: string;
  count?: number;
};

type ScenarioRunInput =
  | string
  | {
      id?: string;
      lua?: string;
    };

export type ScenarioTools = {
  list: () => Promise<ScenarioDescriptor[]>;
  get: (id: string) => Promise<ScenarioDescriptor | null>;
  create: (input: ScenarioCreateInput) => Promise<ScenarioDescriptor>;
  run: (input: ScenarioRunInput) => Promise<{
    id: string;
    pass: boolean;
    error?: string;
    diff?: string;
  }>;
  runAll: (filter?: string) => Promise<
    Array<{
      id: string;
      pass: boolean;
      error?: string;
      diff?: string;
    }>
  >;
  mutate: (input: ScenarioMutateInput) => Promise<ScenarioDescriptor[]>;
};

type CreateScenarioToolsOptions = {
  adapter?: ExecuteLuaScenarioInput["adapter"];
};

async function runLua(
  source: string,
  adapter?: ExecuteLuaScenarioInput["adapter"],
): Promise<{
  pass: boolean;
  error?: string;
  diff?: string;
}> {
  const execution = await executeLuaScenario({
    source,
    adapter,
  });

  return {
    pass: execution.pass,
    error: execution.error,
    diff: execution.result?.diff,
  };
}

export function createScenarioTools(
  seed: ScenarioDescriptor[],
  options: CreateScenarioToolsOptions = {},
): ScenarioTools {
  const store = new Map(seed.map((item) => [item.id, { ...item }]));

  return {
    async list() {
      return Array.from(store.values());
    },

    async get(id) {
      return store.get(id) ?? null;
    },

    async create(input) {
      const nextId = input.id && input.id.length > 0 ? input.id : `scenario-${store.size + 1}`;
      const nextName =
        input.name && input.name.length > 0 ? input.name : `scenario ${store.size + 1}`;
      const next = {
        id: nextId,
        name: nextName,
        lua: input.lua,
        tags: input.tags,
      };
      store.set(next.id, next);
      return next;
    },

    async run(input) {
      if (typeof input !== "string" && input.lua) {
        const executed = await runLua(input.lua, options.adapter);
        return {
          id: "inline",
          ...executed,
        };
      }

      const id = typeof input === "string" ? input : String(input.id ?? "");
      const scenario = store.get(id);
      if (!scenario) {
        throw new Error(`Scenario not found: ${id}`);
      }

      if (!scenario.lua) {
        return {
          id,
          pass: false,
          error: "scenario_lua_missing",
        };
      }

      const executed = await runLua(scenario.lua, options.adapter);

      return {
        id,
        ...executed,
      };
    },

    async runAll(filter) {
      const candidates = Array.from(store.values()).filter((scenario) => {
        if (!filter) {
          return true;
        }
        return scenario.id.includes(filter) || scenario.name.includes(filter);
      });

      return Promise.all(
        candidates.map(async (item) => {
          if (!item.lua) {
            return {
              id: item.id,
              pass: false,
              error: "scenario_lua_missing",
            };
          }

          const executed = await runLua(item.lua, options.adapter);
          return {
            id: item.id,
            ...executed,
          };
        }),
      );
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
