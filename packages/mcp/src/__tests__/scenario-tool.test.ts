import { describe, expect, it } from "vitest";

import { createScenarioTools } from "../tools/scenario";

describe("mcp scenario tools", () => {
  it("lists registered scenarios", async () => {
    const tools = createScenarioTools([
      {
        id: "swap-1",
        name: "swap happy path",
      },
    ]);

    await expect(tools.list()).resolves.toEqual([
      {
        id: "swap-1",
        name: "swap happy path",
      },
    ]);
  });

  it("supports runAll and mutate", async () => {
    const tools = createScenarioTools([
      {
        id: "swap-1",
        name: "swap happy path",
        lua: "scenario { name = 'swap', given = {}, when = { action = 'swap' }, then_ui = {} }",
      },
      {
        id: "bridge-1",
        name: "bridge pending path",
        lua: "scenario { name = 'bridge', given = {}, when = { action = 'bridge' }, then_ui = {} }",
      },
    ], {
      adapter: {
        resolveUi: async () => ({}),
      },
    });

    await expect(tools.runAll("swap")).resolves.toEqual([
      {
        id: "swap-1",
        pass: true,
        diff: "",
        error: undefined,
      },
    ]);

    await expect(tools.mutate({ id: "swap-1", count: 2 })).resolves.toEqual([
      expect.objectContaining({
        id: "swap-1-mut-1",
        name: "swap happy path mutation 1",
      }),
      expect.objectContaining({
        id: "swap-1-mut-2",
        name: "swap happy path mutation 2",
      }),
    ]);
  });

  it("creates scenario from lua only and runs inline", async () => {
    const tools = createScenarioTools([], {
      adapter: {
        resolveUi: async () => ({}),
      },
    });

    const created = await tools.create({
      lua: "scenario { name = 'inline' }",
    });

    expect(created.id).toBe("scenario-1");
    expect(created.name).toBe("scenario 1");

    await expect(
      tools.run({
        lua: "scenario { name = 'inline' }",
      }),
    ).resolves.toEqual({
      id: "inline",
      pass: true,
      diff: "",
      error: undefined,
    });
  });

  it("preserves coverage metadata on create and mutate", async () => {
    const tools = createScenarioTools([], {
      adapter: {
        resolveUi: async () => ({}),
      },
      getCoverageSnapshot: async () => ({
        total: 3,
        covered: 1,
        ratio: 0.3333,
        known: {
          features: ["swap", "approve"],
          states: ["quoteLoaded"],
          components: ["SwapForm"],
        },
        coveredTargets: {
          features: ["swap"],
          states: [],
          components: [],
        },
        missing: {
          features: ["approve"],
          states: ["quoteLoaded"],
          components: ["SwapForm"],
        },
      }),
    });

    const created = await tools.create({
      id: "swap-coverage",
      name: "swap coverage",
      lua: "scenario { name = 'swap-coverage', given = {}, when = { action = 'swap' }, then_ui = {} }",
      coverage: {
        features: ["swap"],
      },
    });

    expect(created.coverage).toEqual({
      features: ["swap"],
    });

    const mutated = await tools.mutate({
      id: "swap-coverage",
      count: 1,
    });

    expect(mutated[0]).toEqual(
      expect.objectContaining({
        coverage: {
          features: ["swap", "approve"],
          states: ["quoteLoaded"],
          components: ["SwapForm"],
        },
      }),
    );
  });
});
