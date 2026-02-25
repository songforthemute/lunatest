import {
  assertNot,
  assertState,
  assertTiming,
  assertTransition,
  assertUI,
  type AssertionResult,
} from "./assert";

type ScenarioLike = {
  name: string;
  given?: Record<string, unknown>;
  when: {
    action: string;
    [key: string]: unknown;
  };
  then_ui: Record<string, unknown>;
  then_state?: Record<string, unknown>;
  stages?: Array<{ name: string }>;
  not_present?: string[];
  timing_ms?: number;
};

export type RunScenarioInput = {
  scenario: ScenarioLike;
  resolveUi: (
    scenario: ScenarioLike,
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
  resolveState?: (
    scenario: ScenarioLike,
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
  resolveTransitions?: (
    scenario: ScenarioLike,
  ) => Promise<string[]> | string[];
  resolveElapsedMs?: (
    scenario: ScenarioLike,
  ) => Promise<number> | number;
};

export type RunScenarioResult = {
  scenarioName: string;
  pass: boolean;
  diff: string;
  expectedUi: Record<string, unknown>;
  actualUi: Record<string, unknown>;
  expectedState?: Record<string, unknown>;
  actualState?: Record<string, unknown>;
  assertions: Record<string, AssertionResult>;
};

export type RunAllResult = {
  total: number;
  passed: number;
  failed: number;
  results: RunScenarioResult[];
};

function missingResolver(label: string): AssertionResult {
  return {
    pass: false,
    diff: `${label} resolver is required for this scenario`,
    expected: "resolver",
    actual: "missing",
  };
}

function collectFailureDiff(assertions: Record<string, AssertionResult>): string {
  return Object.entries(assertions)
    .filter(([, value]) => !value.pass)
    .map(([name, value]) => `[${name}] ${value.diff}`)
    .join("\n");
}

export async function runScenario(input: RunScenarioInput): Promise<RunScenarioResult> {
  const actualUi = await input.resolveUi(input.scenario);
  const assertions: Record<string, AssertionResult> = {
    ui: assertUI(input.scenario.then_ui, actualUi),
  };

  let actualState: Record<string, unknown> | undefined;
  if (input.scenario.then_state) {
    if (!input.resolveState) {
      assertions.state = missingResolver("state");
    } else {
      actualState = await input.resolveState(input.scenario);
      assertions.state = assertState(input.scenario.then_state, actualState);
    }
  }

  if (input.scenario.stages && input.scenario.stages.length > 0) {
    const expectedPath = input.scenario.stages.map((stage) => stage.name);
    if (!input.resolveTransitions) {
      assertions.transition = missingResolver("transition");
    } else {
      const actualPath = await input.resolveTransitions(input.scenario);
      assertions.transition = assertTransition(expectedPath, actualPath);
    }
  }

  if (input.scenario.not_present && input.scenario.not_present.length > 0) {
    assertions.negative = assertNot(input.scenario.not_present, actualUi);
  }

  if (input.scenario.timing_ms !== undefined) {
    if (!input.resolveElapsedMs) {
      assertions.timing = missingResolver("timing");
    } else {
      const elapsedMs = await input.resolveElapsedMs(input.scenario);
      assertions.timing = assertTiming(input.scenario.timing_ms, elapsedMs);
    }
  }

  const pass = Object.values(assertions).every((result) => result.pass);

  return {
    scenarioName: input.scenario.name,
    pass,
    diff: collectFailureDiff(assertions),
    expectedUi: input.scenario.then_ui,
    actualUi,
    expectedState: input.scenario.then_state,
    actualState,
    assertions,
  };
}

export async function runAll(items: RunScenarioInput[]): Promise<RunAllResult> {
  const results = await Promise.all(items.map((item) => runScenario(item)));
  const passed = results.filter((result) => result.pass).length;

  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
  };
}
