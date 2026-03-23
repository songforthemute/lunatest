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
  scenarioDir: string;
}): Promise<string[]> {
  const target = input.scenario?.trim();
  if (!target) {
    const discovered = new Set<string>();

    if (await canAccess(input.luaConfigPath)) {
      discovered.add(input.luaConfigPath);
    }

    if (await canAccess(input.scenarioDir)) {
      const matched = await glob(`${input.scenarioDir.replace(/\\/g, "/")}/**/*.lua`, {
        onlyFiles: true,
      });

      for (const item of matched) {
        discovered.add(item);
      }
    }

    if (discovered.size === 0) {
      throw new Error(`Scenario source not found: ${input.luaConfigPath}`);
    }

    return Array.from(discovered).sort();
  }

  if (!GLOB_CHARS.test(target)) {
    if (!(await canAccess(target))) {
      throw new Error(`Scenario source not found: ${target}`);
    }

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
