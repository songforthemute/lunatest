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
});
