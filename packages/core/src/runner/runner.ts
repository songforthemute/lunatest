import { assertUI, type AssertionResult } from "./assert";

type ScenarioLike = {
  name: string;
  when: {
    action: string;
    [key: string]: unknown;
  };
  then_ui: Record<string, unknown>;
};

export type RunScenarioInput = {
  scenario: ScenarioLike;
  resolveUi: (
    scenario: ScenarioLike,
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
};

export type RunScenarioResult = {
  scenarioName: string;
  pass: boolean;
  diff: string;
  expectedUi: Record<string, unknown>;
  actualUi: Record<string, unknown>;
};

export type RunAllResult = {
  total: number;
  passed: number;
  failed: number;
  results: RunScenarioResult[];
};

function toResult(
  scenario: ScenarioLike,
  actualUi: Record<string, unknown>,
  assertion: AssertionResult,
): RunScenarioResult {
  return {
    scenarioName: scenario.name,
    pass: assertion.pass,
    diff: assertion.diff,
    expectedUi: scenario.then_ui,
    actualUi,
  };
}

export async function runScenario(input: RunScenarioInput): Promise<RunScenarioResult> {
  const actualUi = await input.resolveUi(input.scenario);
  const assertion = assertUI(input.scenario.then_ui, actualUi);

  return toResult(input.scenario, actualUi, assertion);
}

export async function runAll(
  items: RunScenarioInput[],
): Promise<RunAllResult> {
  const results = await Promise.all(items.map((item) => runScenario(item)));
  const passed = results.filter((result) => result.pass).length;

  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
  };
}
