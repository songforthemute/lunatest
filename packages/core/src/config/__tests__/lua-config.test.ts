import { describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadLunaConfig } from "../lua-config";

describe("loadLunaConfig", () => {
  it("loads inline Lua DSL with scenario block", async () => {
    const config = await loadLunaConfig(`
      scenario {
        name = "swap-warning",
        mode = "strict",
        given = {
          chain = { id = 1 },
          wallet = { connected = true }
        },
        intercept = {
          routes = {
            { endpointType = "ethereum", method = "eth_chainId", responseKey = "chain-id" },
            { endpointType = "http", urlPattern = "https://api.example/quote", method = "GET", responseKey = "quote" }
          }
        }
      }
    `);

    expect(config.name).toBe("swap-warning");
    expect(config.mode).toBe("strict");
    expect(config.given.wallet).toEqual({
      connected: true,
    });
    expect(config.intercept?.routes).toHaveLength(2);
  });

  it("loads Lua file path source", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lunatest-core-"));
    const file = join(dir, "scenario.lua");
    await writeFile(
      file,
      `scenario {
  name = "file-scenario",
  mode = "permissive",
  given = { chain = { id = 1 } }
}`,
      "utf8",
    );

    const config = await loadLunaConfig(file);
    expect(config.name).toBe("file-scenario");
    expect(config.mode).toBe("permissive");

    await rm(dir, { recursive: true, force: true });
  });

  it("throws when Lua DSL does not expose scenario config", async () => {
    await expect(
      loadLunaConfig(`
        local value = 1
      `),
    ).rejects.toThrow("Lua config must declare scenario");
  });
});
