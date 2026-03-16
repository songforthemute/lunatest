type LuaSource = string | URL;

function seemsInlineLua(input: string): boolean {
  return input.includes("\n") || input.includes("scenario {") || input.includes("scenario{");
}

export async function readLuaSource(source: LuaSource): Promise<string> {
  if (source instanceof URL) {
    if (source.protocol === "http:" || source.protocol === "https:") {
      if (typeof fetch !== "function") {
        throw new Error(`Fetch API is unavailable for URL source: ${source.toString()}`);
      }

      const response = await fetch(source);
      if (!response.ok) {
        throw new Error(`Failed to load Lua source: ${source.toString()} (${response.status})`);
      }

      return response.text();
    }

    if (source.protocol !== "file:") {
      throw new Error(`Unsupported Lua source URL protocol: ${source.protocol}`);
    }

    const [{ fileURLToPath }, { readFile }] = await Promise.all([
      import("node:url"),
      import("node:fs/promises"),
    ]);

    return readFile(fileURLToPath(source), "utf8");
  }

  if (seemsInlineLua(source)) {
    return source;
  }

  if (typeof document !== "undefined" && typeof fetch === "function") {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to load Lua source: ${source} (${response.status})`);
    }

    return response.text();
  }

  try {
    const { readFile } = await import("node:fs/promises");
    return await readFile(source, "utf8");
  } catch {
    return source;
  }
}
