import {
  listLunaProjectScenarios,
  runAllLunaProjectScenarios,
  runLunaProjectScenario,
  type ExecuteLuaScenarioAdapter,
  type LunaProjectRunnerOptions,
  type LunaProjectScenarioExecution,
} from "@lunatest/core";

export type LunaVitestScenarioAdapter = ExecuteLuaScenarioAdapter;
export type LunaVitestScenarioExecution = LunaProjectScenarioExecution;

export class LunaVitestScenarioAssertionError extends Error {
  readonly execution: LunaVitestScenarioExecution;

  constructor(execution: LunaVitestScenarioExecution) {
    const lines = [
      `LunaTest scenario failed: ${JSON.stringify(execution.scenario.id)}`,
      `source=${execution.scenario.source}`,
    ];

    if (execution.execution.error) {
      lines.push(`error=${execution.execution.error}`);
    }

    if (execution.execution.result?.diff) {
      lines.push(`diff=${execution.execution.result.diff}`);
    }

    super(lines.join("\n"));
    this.name = "LunaVitestScenarioAssertionError";
    this.execution = execution;
  }
}

export type LunaVitestRunnerOptions = LunaProjectRunnerOptions;

export type LunaVitestRunner = {
  listScenarios: () => ReturnType<typeof import("@lunatest/core").listLunaProjectScenarios>;
  runScenario: (
    scenarioId: string,
    adapter: LunaVitestScenarioAdapter,
  ) => Promise<LunaVitestScenarioExecution>;
  assertScenario: (
    scenarioId: string,
    adapter: LunaVitestScenarioAdapter,
  ) => Promise<LunaVitestScenarioExecution>;
  runAll: (
    createAdapter: (scenario: LunaVitestScenarioExecution["scenario"]) => LunaVitestScenarioAdapter,
  ) => Promise<LunaVitestScenarioExecution[]>;
};

export function createLunaVitestRunner(options: LunaVitestRunnerOptions = {}): LunaVitestRunner {
  return {
    listScenarios() {
      return listLunaProjectScenarios(options);
    },
    runScenario(scenarioId, adapter) {
      return runLunaProjectScenario({
        ...options,
        scenarioId,
        adapter,
      });
    },
    async assertScenario(scenarioId, adapter) {
      const execution = await runLunaProjectScenario({
        ...options,
        scenarioId,
        adapter,
      });

      if (!execution.execution.pass) {
        throw new LunaVitestScenarioAssertionError(execution);
      }

      return execution;
    },
    runAll(createAdapter) {
      return runAllLunaProjectScenarios({
        ...options,
        createAdapter,
      });
    },
  };
}
