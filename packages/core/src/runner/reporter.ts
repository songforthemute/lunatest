import type { RunAllResult } from "./runner";

export function toConsoleReport(result: RunAllResult): string {
  return [
    `Scenario Summary`,
    `total=${result.total}`,
    `passed=${result.passed}`,
    `failed=${result.failed}`,
  ].join("\n");
}

export function toJsonReport(result: RunAllResult): string {
  return JSON.stringify(result, null, 2);
}
