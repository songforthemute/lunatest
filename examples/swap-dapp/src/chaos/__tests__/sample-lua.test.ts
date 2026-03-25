import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { loadLunaConfig } from "@lunatest/core/browser";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_LUA_PATH = path.resolve(TEST_DIR, "../../../lunatest.lua");

describe("swap demo lunatest.lua", () => {
  it("parses as valid LuaConfig", async () => {
    const lua = await readFile(SAMPLE_LUA_PATH, "utf8");
    const parsed = await loadLunaConfig(lua);

    expect(parsed.name).toBe("swap_demo_runtime");
    expect(parsed.mode).toBe("permissive");
  });
});
