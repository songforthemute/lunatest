import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";

const DEFAULT_BASELINE = "scripts/perf-baseline.json";
const DEFAULT_OUTPUT = "scripts/perf-current.json";

function parseArgs(argv) {
  const args = {
    mode: "regression",
    baseline: DEFAULT_BASELINE,
    output: DEFAULT_OUTPUT,
  };

  for (const item of argv) {
    if (item.startsWith("--mode=")) {
      args.mode = item.slice("--mode=".length);
      continue;
    }

    if (item.startsWith("--baseline=")) {
      args.baseline = item.slice("--baseline=".length);
      continue;
    }

    if (item.startsWith("--output=")) {
      args.output = item.slice("--output=".length);
    }
  }

  return args;
}

function loadBaseline(path) {
  if (!existsSync(path)) {
    throw new Error(`Baseline file not found: ${path}`);
  }

  return JSON.parse(readFileSync(path, "utf8"));
}

function evaluateRegression(metrics, baseline) {
  const thresholdP95 = baseline.p95Ms * 1.1;
  const passed = metrics.p95Ms <= thresholdP95;

  return {
    passed,
    reasons: passed
      ? []
      : [
          `p95 regression detected: current=${metrics.p95Ms.toFixed(4)}ms baseline=${baseline.p95Ms.toFixed(4)}ms threshold=${thresholdP95.toFixed(4)}ms`,
        ],
  };
}

function evaluateAbsolute(metrics) {
  const reasons = [];

  if (metrics.p95Ms >= 1) {
    reasons.push(`absolute threshold failed: p95Ms=${metrics.p95Ms.toFixed(4)}ms (target < 1.0000ms)`);
  }

  if (metrics.totalMs1000 >= 1000) {
    reasons.push(
      `absolute threshold failed: totalMs1000=${metrics.totalMs1000.toFixed(4)}ms (target < 1000.0000ms)`,
    );
  }

  return {
    passed: reasons.length === 0,
    reasons,
  };
}

function percentile(values, ratio) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));

  return sorted[index] ?? 0;
}

async function loadCoreRunner() {
  const runnerPath = resolve(
    process.cwd(),
    "packages/core/dist/runner/runner.js",
  );
  return import(runnerPath);
}

async function runScenarioThroughCore(runScenarioFn, scenario, resolveUi) {
  const result = await runScenarioFn({
    scenario,
    resolveUi,
  });
  return result.pass;
}

async function measureIterations(iterations, runScenarioFn, scenario, resolveUi) {
  const samplesMs = [];
  const totalStart = performance.now();

  for (let index = 0; index < iterations; index += 1) {
    const started = performance.now();
    await runScenarioThroughCore(runScenarioFn, scenario, resolveUi);
    samplesMs.push(performance.now() - started);
  }

  const totalMs = performance.now() - totalStart;

  return {
    totalMs,
    p95Ms: percentile(samplesMs, 0.95),
    averageMs: iterations === 0 ? 0 : totalMs / iterations,
  };
}

async function collectMetrics() {
  const { runScenario } = await loadCoreRunner();
  const scenario = {
    name: "perf-gate",
    given: {},
    when: { action: "swap" },
    then_ui: { warning: false },
  };
  const resolveUi = async () => ({ warning: false });

  await measureIterations(20, runScenario, scenario, resolveUi);

  const sample = await measureIterations(200, runScenario, scenario, resolveUi);
  const thousand = await measureIterations(1000, runScenario, scenario, resolveUi);

  return {
    measuredAt: new Date().toISOString(),
    p95Ms: sample.p95Ms,
    averageMs: sample.averageMs,
    totalMs200: sample.totalMs,
    totalMs1000: thousand.totalMs,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mode = args.mode;

  const metricsFirst = await collectMetrics();

  const baseline = mode === "regression" ? loadBaseline(resolve(args.baseline)) : null;

  const evaluate = (metrics) => {
    if (mode === "absolute") {
      return evaluateAbsolute(metrics);
    }

    return evaluateRegression(metrics, baseline);
  };

  let evaluation = evaluate(metricsFirst);
  let finalMetrics = metricsFirst;

  if (!evaluation.passed) {
    const retryMetrics = await collectMetrics();
    const retryEvaluation = evaluate(retryMetrics);

    finalMetrics = retryMetrics;
    evaluation = retryEvaluation;
  }

  const outputPath = resolve(args.output);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(
    outputPath,
    JSON.stringify(
      {
        mode,
        baseline,
        metrics: finalMetrics,
        passed: evaluation.passed,
        reasons: evaluation.reasons,
      },
      null,
      2,
    ) + "\n",
  );

  console.log(`mode=${mode}`);
  console.log(`p95Ms=${finalMetrics.p95Ms.toFixed(4)}`);
  console.log(`totalMs1000=${finalMetrics.totalMs1000.toFixed(4)}`);

  if (!evaluation.passed) {
    for (const reason of evaluation.reasons) {
      console.error(reason);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
