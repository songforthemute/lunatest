import { resolve } from "node:path";

import {
  loadLunaProjectConfig,
  type LoadLunaProjectConfigOptions,
  type ResolvedLunaProjectConfig,
} from "./config.node.js";
import {
  loadLunaProjectScenarios,
  type LunaProjectScenario,
} from "./scenarios.node.js";
import {
  executeLuaScenario,
  type ExecuteLuaScenarioAdapter,
  type ExecuteLuaScenarioResult,
} from "../runner/execute-scenario.js";

export type LunaProjectRunnerOptions = Pick<
  LoadLunaProjectConfigOptions,
  "cwd" | "configPath"
> & {
  scenarioDir?: string;
};

export type RunLunaProjectScenarioOptions = LunaProjectRunnerOptions & {
  scenarioId: string;
  adapter: ExecuteLuaScenarioAdapter;
};

export type RunAllLunaProjectScenariosOptions = LunaProjectRunnerOptions & {
  createAdapter: (scenario: LunaProjectScenario) => ExecuteLuaScenarioAdapter;
};

export type LunaProjectScenarioExecution = {
  scenario: LunaProjectScenario;
  execution: ExecuteLuaScenarioResult;
};

export class LunaProjectScenarioNotFoundError extends Error {
  constructor(scenarioId: string) {
    super(`LunaTest scenario ID not found: ${JSON.stringify(scenarioId)}`);
    this.name = "LunaProjectScenarioNotFoundError";
  }
}

function withScenarioDirectory(
  config: ResolvedLunaProjectConfig,
  scenarioDir: string | undefined,
): ResolvedLunaProjectConfig {
  if (!scenarioDir) {
    return config;
  }

  return {
    ...config,
    config: {
      ...config.config,
      scenarioDir,
    },
    scenarioDir,
    resolvedScenarioDir: resolve(config.projectRoot, scenarioDir),
  };
}

async function loadProject(
  options: LunaProjectRunnerOptions,
): Promise<ResolvedLunaProjectConfig> {
  const config = await loadLunaProjectConfig({
    cwd: options.cwd,
    configPath: options.configPath,
  });

  return withScenarioDirectory(config, options.scenarioDir);
}

export async function listLunaProjectScenarios(
  options: LunaProjectRunnerOptions = {},
): Promise<LunaProjectScenario[]> {
  const config = await loadProject(options);
  return loadLunaProjectScenarios({ config });
}

async function resolveScenario(
  options: LunaProjectRunnerOptions,
  scenarioId: string,
): Promise<LunaProjectScenario> {
  const scenarios = await listLunaProjectScenarios(options);
  const scenario = scenarios.find((item) => item.id === scenarioId);

  if (!scenario) {
    throw new LunaProjectScenarioNotFoundError(scenarioId);
  }

  return scenario;
}

async function executeProjectScenario(
  scenario: LunaProjectScenario,
  adapter: ExecuteLuaScenarioAdapter,
): Promise<LunaProjectScenarioExecution> {
  return {
    scenario,
    execution: await executeLuaScenario({
      source: scenario.config,
      adapter,
    }),
  };
}

export async function runLunaProjectScenario(
  options: RunLunaProjectScenarioOptions,
): Promise<LunaProjectScenarioExecution> {
  const scenario = await resolveScenario(options, options.scenarioId);
  return executeProjectScenario(scenario, options.adapter);
}

export async function runAllLunaProjectScenarios(
  options: RunAllLunaProjectScenariosOptions,
): Promise<LunaProjectScenarioExecution[]> {
  const scenarios = await listLunaProjectScenarios(options);
  const executions: LunaProjectScenarioExecution[] = [];

  for (const scenario of scenarios) {
    executions.push(await executeProjectScenario(scenario, options.createAdapter(scenario)));
  }

  return executions;
}
