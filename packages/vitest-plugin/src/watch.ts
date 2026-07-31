import { relative, resolve } from "node:path";

import { loadLunaProjectConfigSync, type LunaProjectRunnerOptions } from "@lunatest/core";

export type LunaVitestWatchTriggerOptions = LunaProjectRunnerOptions & {
  root?: string;
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

function trimTrailingSlashes(value: string): string {
  const trimmed = value.replace(/\/+$/u, "");
  return trimmed.length === 0 && value.startsWith("/") ? "/" : trimmed;
}

export function createLunaVitestWatchTrigger(
  options: LunaVitestWatchTriggerOptions,
): LunaVitestWatchTrigger {
  if (options.testFiles.length === 0) {
    throw new Error("LunaTest watch trigger requires at least one harness test file");
  }

  const project = loadLunaProjectConfigSync(options);
  const root = resolve(options.root ?? options.cwd ?? process.cwd());
  const scenarioDirPath = resolve(
    resolve(project.projectRoot, options.scenarioDir ?? project.scenarioDir),
  );
  const resolvedScenarioDir = trimTrailingSlashes(toPosixPath(scenarioDirPath));
  const relativeScenarioDir = trimTrailingSlashes(toPosixPath(relative(root, scenarioDirPath)));
  const testFiles = [...options.testFiles];
  const patternPrefixes = new Set(
    [resolvedScenarioDir, relativeScenarioDir]
      .filter((directory) => directory.length > 0)
      .map((directory) => escapeRegExp(directory === "/" ? "/" : `${directory}/`)),
  );

  if (relativeScenarioDir.length === 0) {
    patternPrefixes.add("(?!/|[A-Za-z]:/)(?!.*(?:^|/)\\.\\.(?:/|$))");
  }

  return {
    pattern: new RegExp(`^(?:${Array.from(patternPrefixes).join("|")})[^/].*\\.lua$`),
    testsToRun: () => [...testFiles],
  };
}
