import {
  listLunaProjectScenarios,
  runAllLunaProjectScenarios,
  runLunaProjectScenario,
  type ExecuteLuaScenarioAdapter,
  type LunaProjectRunnerOptions,
  type LunaProjectScenarioExecution,
} from "@lunatest/core";

export type LunaCommandOptions = LunaProjectRunnerOptions;
export type LunaCommandScenarioAdapter = ExecuteLuaScenarioAdapter;
export type LunaCommandScenarioExecution = LunaProjectScenarioExecution;

export class LunaCommandAssertionError extends Error {
  readonly execution: LunaCommandScenarioExecution;

  constructor(execution: LunaCommandScenarioExecution) {
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
    this.name = "LunaCommandAssertionError";
    this.execution = execution;
  }
}

export type LunaCommandApi = {
  listScenarios: () => ReturnType<typeof listLunaProjectScenarios>;
  runScenario: (
    scenarioId: string,
    adapter: LunaCommandScenarioAdapter,
  ) => Promise<LunaCommandScenarioExecution>;
  assertScenario: (
    scenarioId: string,
    adapter: LunaCommandScenarioAdapter,
  ) => Promise<LunaCommandScenarioExecution>;
  runAll: (
    createAdapter: (scenario: LunaCommandScenarioExecution["scenario"]) => LunaCommandScenarioAdapter,
  ) => Promise<LunaCommandScenarioExecution[]>;
};

export function createLunaCommands(options: LunaCommandOptions = {}): LunaCommandApi {
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
        throw new LunaCommandAssertionError(execution);
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
