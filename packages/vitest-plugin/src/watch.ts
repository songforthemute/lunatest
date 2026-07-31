import { resolve } from "node:path";

export type LunaVitestWatchTriggerOptions = {
  cwd?: string;
  scenarioDir?: string;
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

  const scenarioDir = toPosixPath(
    resolve(options.cwd ?? process.cwd(), options.scenarioDir ?? "scenarios"),
  ).replace(/\/+$/u, "");
  const testFiles = [...options.testFiles];

  return {
    pattern: new RegExp(`^${escapeRegExp(scenarioDir)}/.*\\.lua$`),
    testsToRun: () => [...testFiles],
  };
}
