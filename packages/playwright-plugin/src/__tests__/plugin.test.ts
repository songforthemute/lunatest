import { describe, expect, it } from "vitest";

import { createLunaCommands } from "../commands";
import { createLunaFixture } from "../fixture";

describe("playwright plugin", () => {
  it("creates fixture", async () => {
    const fixture = createLunaFixture();
    await expect(fixture.injectProvider()).resolves.toBeUndefined();
  });

  it("creates commands", async () => {
    const commands = createLunaCommands();
    await expect(commands.runScenario("swap-1")).resolves.toEqual({
      id: "swap-1",
      pass: true,
    });
  });
});
