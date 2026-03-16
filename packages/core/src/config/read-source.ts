type LuaSource = string | URL;

function seemsInlineLua(input: string): boolean {
  return input.includes("\n") || input.includes("scenario {") || input.includes("scenario{");
}

function canUseBrowserFetch(): boolean {
  return typeof document !== "undefined" && typeof fetch === "function";
}

function getBuiltinModule<T>(specifier: string): T | null {
  if (
    typeof process === "undefined" ||
    typeof process.getBuiltinModule !== "function"
  ) {
    return null;
  }

  return process.getBuiltinModule(specifier) as T | null;
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

    const urlModule = getBuiltinModule<typeof import("node:url")>("url");
    const fsModule = getBuiltinModule<typeof import("node:fs/promises")>("fs/promises");
    if (!urlModule || !fsModule) {
      throw new Error(`File URL source is unavailable in this runtime: ${source.toString()}`);
    }

    return fsModule.readFile(urlModule.fileURLToPath(source), "utf8");
  }

  if (seemsInlineLua(source)) {
    return source;
  }

  if (canUseBrowserFetch()) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to load Lua source: ${source} (${response.status})`);
    }

    return response.text();
  }

  const fsModule = getBuiltinModule<typeof import("node:fs/promises")>("fs/promises");
  if (fsModule) {
    try {
      return await fsModule.readFile(source, "utf8");
    } catch {
      return source;
    }
  }

  return source;
}
