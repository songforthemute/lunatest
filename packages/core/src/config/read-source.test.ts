import { describe, expect, it } from "vitest";

import { readLuaSource } from "./read-source";

describe("readLuaSource", () => {
  it("reads Vite-inlined Lua assets from data URLs", async () => {
    const source = "return { manifest = { id = 'wallet' } }";
    const url = new URL(
      `data:text/plain;base64,${Buffer.from(source).toString("base64")}`,
    );

    await expect(readLuaSource(url)).resolves.toBe(source);
  });
});
