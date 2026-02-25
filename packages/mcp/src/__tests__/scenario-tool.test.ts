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
});
