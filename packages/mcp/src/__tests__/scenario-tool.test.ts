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
      },
      {
        id: "bridge-1",
        name: "bridge pending path",
      },
    ]);

    await expect(tools.runAll("swap")).resolves.toEqual([
      {
        id: "swap-1",
        pass: true,
      },
    ]);

    await expect(tools.mutate({ id: "swap-1", count: 2 })).resolves.toEqual([
      {
        id: "swap-1-mut-1",
        name: "swap happy path mutation 1",
      },
      {
        id: "swap-1-mut-2",
        name: "swap happy path mutation 2",
      },
    ]);
  });

  it("creates scenario from lua only and runs inline", async () => {
    const tools = createScenarioTools([]);

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
    });
  });
});
