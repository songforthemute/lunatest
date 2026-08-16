import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { LunaProjectScenarioExecution } from "@lunatest/core";

export type JourneyEvidence = {
  account: string | null;
  approvalHash: string | null;
  swapHash: string | null;
};

export type ProofRun = {
  durationMs: number;
  evidence: JourneyEvidence;
  fingerprint: string;
  networkAttempts: string[];
  normalizedResult: Record<string, unknown>;
};

function normalizeValue(value: unknown): unknown {
  if (value === undefined) return { $undefined: true };
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalizeValue(item)]),
    );
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalizeValue(value));
}

export function digestCanonical(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalJson(value), "utf8").digest("hex")}`;
}

export function normalizeScenarioExecution(
  execution: LunaProjectScenarioExecution,
): Record<string, unknown> {
  const result = execution.execution.result;
  const assertions = Object.fromEntries(
    Object.entries(result?.assertions ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, assertion]) => [
        name,
        {
          actual: assertion.actual,
          expected: assertion.expected,
          mismatch: assertion.mismatch ?? null,
          pass: assertion.pass,
        },
      ]),
  );

  return normalizeValue({
    assertions,
    error: execution.execution.error ?? null,
    pass: execution.execution.pass,
    result: result
      ? {
          actualState: result.actualState ?? null,
          actualUi: result.actualUi,
          expectedState: result.expectedState ?? null,
          expectedUi: result.expectedUi,
          pass: result.pass,
          scenarioName: result.scenarioName,
        }
      : null,
    scenario: {
      id: execution.scenario.id,
      name: execution.scenario.name,
      sourceDigest: execution.scenario.sourceDigest,
    },
  }) as Record<string, unknown>;
}

export function createProofRun(
  execution: LunaProjectScenarioExecution,
  evidence: JourneyEvidence,
  durationMs: number,
  networkAttempts: string[],
): ProofRun {
  const normalizedResult = normalizeScenarioExecution(execution);
  const fingerprint = digestCanonical({
    evidence,
    networkAttemptCount: networkAttempts.length,
    normalizedResult,
  });

  return {
    durationMs,
    evidence,
    fingerprint,
    networkAttempts: [...networkAttempts],
    normalizedResult,
  };
}

export function proofIterationCount(): number {
  const raw = process.env.LUNATEST_PROOF_RUNS;
  if (!raw) return 1;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`LUNATEST_PROOF_RUNS must be a positive integer, received ${raw}`);
  }
  return parsed;
}

export async function writeProofFragment(
  runner: "playwright" | "vitest",
  value: unknown,
): Promise<void> {
  const proofDir = process.env.LUNATEST_PROOF_DIR;
  if (!proofDir) return;
  const path = join(proofDir, `${runner}.json`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function sanitizeNetworkTarget(input: unknown): string {
  try {
    const candidate =
      input && typeof input === "object" && "url" in input
        ? Reflect.get(input, "url")
        : input;
    const url = new URL(String(candidate));
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return "invalid-url";
  }
}

export function sanitizeOutboundHttpTarget(input: unknown): string | null {
  try {
    const candidate =
      input && typeof input === "object" && "url" in input
        ? Reflect.get(input, "url")
        : input;
    const url = new URL(String(candidate));
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return sanitizeNetworkTarget(url);
  } catch {
    return null;
  }
}
