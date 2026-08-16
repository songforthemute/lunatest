import { afterEach, describe, expect, it } from "vitest";
import { performance } from "node:perf_hooks";

import { disableLunaRuntimeIntercept } from "@lunatest/runtime-intercept";
import { createLunaVitestRunner } from "@lunatest/vitest-plugin";

import {
  createSwapJourney,
  observeJourneyState,
  observeJourneyUi,
} from "../src/journey";
import { createJourneyConfig } from "../src/wagmi";
import { reportSharedScenario, SWAP_SCENARIO_ID } from "./shared-scenario";
import {
  createProofRun,
  proofIterationCount,
  sanitizeNetworkTarget,
  sanitizeOutboundHttpTarget,
  writeProofFragment,
  type JourneyEvidence,
  type ProofRun,
} from "./proof-metrics";

afterEach(() => disableLunaRuntimeIntercept());

describe("shared swap scenario", () => {
  it("executes the application journey through the Vitest runner", async () => {
    const iterations = proofIterationCount();
    const allNetworkAttempts: string[] = [];
    const measuredRuns: ProofRun[] = [];
    const runner = createLunaVitestRunner({ cwd: process.cwd() });
    let lastJourney: ReturnType<typeof createSwapJourney> | undefined;
    let sharedScenarioReported = false;

    for (let index = iterations > 1 ? -1 : 0; index < iterations; index += 1) {
      const guard = installNodeOutboundGuard();
      try {
        const config = await createJourneyConfig();
        guard.blockRuntimeBoundary();
        const journey = createSwapJourney(config);
        const started = performance.now();
        const execution = await runner.runScenario(SWAP_SCENARIO_ID, {
          async runWhen({ config }) {
            if (config.when?.action !== "complete_swap") {
              throw new Error(`Unsupported journey action: ${String(config.when?.action)}`);
            }
            await journey.connectWallet();
            await journey.requestQuote();
            await journey.approveToken();
            await journey.swapToken();
          },
          resolveUi: () => observeJourneyUi(journey.getSnapshot()),
          resolveState: () => observeJourneyState(journey.getSnapshot()),
          resolveTransitions: () => [...journey.getSnapshot().history],
        });
        const durationMs = performance.now() - started;

        if (index >= 0) {
          const snapshot = journey.getSnapshot();
          const evidence: JourneyEvidence = {
            account: snapshot.account ?? null,
            approvalHash: snapshot.approvalHash ?? null,
            swapHash: snapshot.swapHash ?? null,
          };
          measuredRuns.push(
            createProofRun(execution, evidence, durationMs, guard.attempts),
          );
          lastJourney = journey;
          if (!sharedScenarioReported) {
            await reportSharedScenario("vitest", execution.scenario);
            sharedScenarioReported = true;
          }
        }
      } finally {
        allNetworkAttempts.push(...guard.attempts);
        disableLunaRuntimeIntercept();
        guard.restore();
      }
    }

    if (!lastJourney) throw new Error("Vitest proof produced no measured journey");
    const diagnostic = await collectDeliberateFailure(runner, lastJourney);
    await writeProofFragment("vitest", {
      deliberateFailure: diagnostic,
      measuredRuns,
      networkAttempts: allNetworkAttempts,
      runner: "vitest",
      warmupRuns: iterations > 1 ? 1 : 0,
    });

    expect(measuredRuns).toHaveLength(iterations);
    const networkAttempts = [...new Set(allNetworkAttempts)];
    expect(
      networkAttempts,
      `Vitest proof attempted outbound network access: ${networkAttempts.join(", ")}`,
    ).toEqual([]);
    expect(measuredRuns.every((run) => readPass(run.normalizedResult))).toBe(true);
    expect(diagnostic.qualityPassed).toBe(true);
  });
});

function readPass(result: Record<string, unknown>): boolean {
  return result.pass === true;
}

function installNodeOutboundGuard(): {
  attempts: string[];
  blockRuntimeBoundary: () => void;
  restore: () => void;
} {
  const attempts: string[] = [];
  const originalFetch = Reflect.get(globalThis, "fetch");
  const originalWebSocket = Reflect.get(globalThis, "WebSocket");
  Reflect.set(globalThis, "fetch", async (input: unknown) => {
    const target = sanitizeOutboundHttpTarget(input);
    if (target === null) return callFetch(originalFetch, input);
    attempts.push(`http:${target}`);
    throw new Error(`Outbound HTTP is blocked: ${target}`);
  });
  Reflect.set(
    globalThis,
    "WebSocket",
    class BlockedWebSocket {
      constructor(input: unknown) {
        const target = sanitizeNetworkTarget(input);
        attempts.push(`ws:${target}`);
        throw new Error(`Outbound WebSocket is blocked: ${target}`);
      }
    },
  );

  return {
    attempts,
    blockRuntimeBoundary() {
      const runtimeFetch = Reflect.get(globalThis, "fetch");
      Reflect.set(globalThis, "fetch", async (input: unknown) => {
        const target = sanitizeOutboundHttpTarget(input);
        if (target === null) return callFetch(runtimeFetch, input);
        attempts.push(`http:${target}`);
        throw new Error(`Outbound HTTP is blocked: ${target}`);
      });
      Reflect.set(
        globalThis,
        "WebSocket",
        class BlockedRuntimeWebSocket {
          constructor(input: unknown) {
            const target = sanitizeNetworkTarget(input);
            attempts.push(`ws:${target}`);
            throw new Error(`Outbound WebSocket is blocked: ${target}`);
          }
        },
      );
    },
    restore() {
      if (originalFetch === undefined) Reflect.deleteProperty(globalThis, "fetch");
      else Reflect.set(globalThis, "fetch", originalFetch);
      if (originalWebSocket === undefined) Reflect.deleteProperty(globalThis, "WebSocket");
      else Reflect.set(globalThis, "WebSocket", originalWebSocket);
    },
  };
}

function callFetch(fetchValue: unknown, input: unknown): Promise<unknown> {
  if (typeof fetchValue !== "function") {
    throw new Error("Fetch API is unavailable for a non-network resource");
  }
  return Reflect.apply(fetchValue, globalThis, [input]);
}

async function collectDeliberateFailure(
  runner: ReturnType<typeof createLunaVitestRunner>,
  journey: ReturnType<typeof createSwapJourney>,
): Promise<Record<string, unknown>> {
  try {
    await runner.assertScenario(SWAP_SCENARIO_ID, {
      resolveUi: () => ({
        ...observeJourneyUi(journey.getSnapshot()),
        output_balance: "1799",
      }),
      resolveState: () => observeJourneyState(journey.getSnapshot()),
      resolveTransitions: () => [...journey.getSnapshot().history],
    });
    throw new Error("Deliberate mismatch unexpectedly passed");
  } catch (cause) {
    if (!(cause instanceof Error) || !("execution" in cause)) throw cause;
    const error = cause as Error & {
      execution: {
        scenario: { id: string };
        execution: {
          result?: {
            assertions: Record<
              string,
              { mismatch?: { path: string; expected: unknown; actual: unknown } }
            >;
          };
        };
      };
    };
    const mismatch = error.execution.execution.result?.assertions.ui?.mismatch;
    const scenarioId = error.execution.scenario.id;
    const qualityPassed = Boolean(
      mismatch &&
        error.message.includes(scenarioId) &&
        error.message.includes(mismatch.path) &&
        error.message.includes(JSON.stringify(mismatch.expected)) &&
        error.message.includes(JSON.stringify(mismatch.actual)),
    );
    return {
      assertion: "ui",
      actual: mismatch?.actual ?? null,
      expected: mismatch?.expected ?? null,
      path: mismatch?.path ?? null,
      qualityPassed,
      scenarioId,
    };
  }
}
