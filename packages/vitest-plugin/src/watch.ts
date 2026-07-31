import { resolve } from "node:path";

import { loadLunaProjectConfigSync, type LunaProjectRunnerOptions } from "@lunatest/core";

export type LunaVitestWatchTriggerOptions = LunaProjectRunnerOptions & {
  testFiles: string[];
};

export type LunaVitestWatchTrigger = {
  pattern: RegExp;
  testsToRun: (id: string) => string[];
};

function toPosixPath(value: string): string {
  return value.replaceAll("\\", "/");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function createLunaVitestWatchTrigger(
  options: LunaVitestWatchTriggerOptions,
): LunaVitestWatchTrigger {
  if (options.testFiles.length === 0) {
    throw new Error("LunaTest watch trigger requires at least one harness test file");
  }

  const project = loadLunaProjectConfigSync(options);
  const scenarioDir = toPosixPath(
    resolve(project.projectRoot, options.scenarioDir ?? project.scenarioDir),
  ).replace(/\/+$/u, "");
  const testFiles = [...options.testFiles];

  return {
    pattern: new RegExp(`^${escapeRegExp(scenarioDir)}/.*\\.lua$`),
    testsToRun: () => [...testFiles],
  };
}
