import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";

import { glob } from "tinyglobby";

const GLOB_CHARS = /[*?[\]{}]/;

async function canAccess(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function resolveScenarioSources(input: {
  scenario?: string;
  luaConfigPath: string;
}): Promise<string[]> {
  const target = input.scenario?.trim();
  if (!target) {
    if (await canAccess(input.luaConfigPath)) {
      return [input.luaConfigPath];
    }

    throw new Error(`Scenario source not found: ${input.luaConfigPath}`);
  }

  if (!GLOB_CHARS.test(target)) {
    return [target];
  }

  const matched = await glob(target, {
    onlyFiles: true,
  });

  if (matched.length === 0) {
    throw new Error(`Scenario glob matched no files: ${target}`);
  }

  return matched;
}
