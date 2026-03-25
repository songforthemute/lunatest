import { performance } from "node:perf_hooks";

import { runScenario, type RunScenarioInput } from "./runner.js";

export type ScenarioPerformanceInput = {
  iterations: number;
  scenario: RunScenarioInput["scenario"];
  resolveUi: RunScenarioInput["resolveUi"];
};

export type ScenarioPerformanceResult = {
  iterations: number;
  totalMs: number;
  averageMs: number;
  p95Ms: number;
  samplesMs: number[];
};

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * ratio) - 1),
  );

  return sorted[index] ?? 0;
}

export async function measureScenarioPerformance(
  input: ScenarioPerformanceInput,
): Promise<ScenarioPerformanceResult> {
  const samplesMs: number[] = [];
  const iterations = Math.max(0, input.iterations);

  const totalStart = performance.now();
  for (let index = 0; index < iterations; index += 1) {
    const start = performance.now();

    await runScenario({
      scenario: input.scenario,
      resolveUi: input.resolveUi,
    });

    samplesMs.push(performance.now() - start);
  }
  const totalMs = performance.now() - totalStart;

  return {
    iterations,
    totalMs,
    averageMs: iterations === 0 ? 0 : totalMs / iterations,
    p95Ms: percentile(samplesMs, 0.95),
    samplesMs,
  };
}
