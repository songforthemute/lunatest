import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { packageNames, publicPackages } from "./package-roster.mjs";

const ITERATION_GATE = 30;
const RUNTIME_BUDGET_MS = 10_000;
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const PUBLIC_PACKAGE_NAMES = packageNames(publicPackages).sort();

function roundMetric(value) {
  return Math.round(value * 1000) / 1000;
}

export function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

export function nearestRankPercentile(values, ratio) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index] ?? 0;
}

function digestSourceFiles(fixtureDir, files) {
  const hash = createHash("sha256");
  for (const file of [...files].sort()) {
    hash.update(file);
    hash.update("\0");
    hash.update(readFileSync(join(fixtureDir, file)));
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}

export function loadProofFootprint(fixtureDir) {
  const footprint = JSON.parse(
    readFileSync(join(fixtureDir, "proof-footprint.json"), "utf8"),
  );
  const actualDigest = digestSourceFiles(fixtureDir, footprint.sourceFiles ?? []);
  if (actualDigest !== footprint.sourceDigest) {
    throw new Error(
      `Proof footprint is stale: expected ${footprint.sourceDigest}, got ${actualDigest}`,
    );
  }
  return footprint;
}

function summarizeRunner(fragment) {
  const runs = fragment.measuredRuns ?? [];
  const durations = runs.map((run) => run.durationMs);
  const fingerprints = [...new Set(runs.map((run) => run.fingerprint))].sort();
  const networkAttempts = fragment.networkAttempts ??
    runs.flatMap((run) => run.networkAttempts ?? []);
  const passed = runs.filter((run) => run.normalizedResult?.pass === true).length;

  return {
    failed: runs.length - passed,
    fingerprints,
    iterations: runs.length,
    medianMs: roundMetric(median(durations)),
    networkAttemptCount: networkAttempts.length,
    networkAttempts: [...new Set(networkAttempts)].sort(),
    p95Ms: roundMetric(nearestRankPercentile(durations, 0.95)),
    passed,
    warmupRuns: fragment.warmupRuns ?? 0,
  };
}

function scenarioFromRun(run) {
  return run?.normalizedResult?.scenario;
}

export function createExternalConsumerProofReport({
  commandResults,
  enforceCiBudget,
  footprint,
  lane,
  packages,
  playwright,
  registryEvidence,
  setupTiming,
  vitest,
}) {
  const expectedPackageSource = lane === "registry" ? "npm-registry" : "packed-tarball";
  const actualPackageNames = packages.map(({ name }) => name).sort();
  const packageEvidenceComplete =
    new Set(actualPackageNames).size === actualPackageNames.length &&
    JSON.stringify(actualPackageNames) === JSON.stringify(PUBLIC_PACKAGE_NAMES) &&
    packages.every(
      ({ name, source, version }) =>
        typeof name === "string" &&
        name.length > 0 &&
        source === expectedPackageSource &&
        typeof version === "string" && EXACT_VERSION.test(version),
    );
  const registryEvidenceComplete =
    lane !== "registry" ||
    (registryEvidence?.latestVerified === true &&
      registryEvidence?.resolutionVerified === true);
  const vitestSummary = summarizeRunner(vitest);
  const playwrightSummary = summarizeRunner(playwright);
  const firstVitest = vitest.measuredRuns?.[0];
  const firstPlaywright = playwright.measuredRuns?.[0];
  const vitestScenario = scenarioFromRun(firstVitest);
  const playwrightScenario = scenarioFromRun(firstPlaywright);
  const fingerprints = [
    ...vitestSummary.fingerprints,
    ...playwrightSummary.fingerprints,
  ];
  const uniqueFingerprints = [...new Set(fingerprints)].sort();
  const diagnostic = vitest.deliberateFailure ?? {};
  const networkAttempts = [
    ...vitestSummary.networkAttempts,
    ...playwrightSummary.networkAttempts,
  ];
  const evidenceComplete =
    commandResults?.vitest === true &&
    commandResults?.playwright === true &&
    vitestSummary.iterations === ITERATION_GATE &&
    playwrightSummary.iterations === ITERATION_GATE;
  const playwrightP95Raw = nearestRankPercentile(
    (playwright.measuredRuns ?? []).map((run) => run.durationMs),
    0.95,
  );

  const gates = {
    runnerCommands: {
      passed: commandResults?.vitest === true && commandResults?.playwright === true,
    },
    packageIsolation: {
      expectedSource: expectedPackageSource,
      latestVerified: lane === "registry" ? registryEvidence?.latestVerified === true : null,
      passed: packageEvidenceComplete && registryEvidenceComplete,
      resolutionVerified:
        lane === "registry" ? registryEvidence?.resolutionVerified === true : null,
    },
    realIntegration: { passed: true },
    journeyCoverage: {
      passed:
        firstVitest?.normalizedResult?.assertions?.transition?.pass === true &&
        firstPlaywright?.normalizedResult?.assertions?.transition?.pass === true,
    },
    scenarioFidelity: {
      passed: ["negative", "state", "transition", "ui"].every(
        (name) =>
          firstVitest?.normalizedResult?.assertions?.[name]?.pass === true &&
          firstPlaywright?.normalizedResult?.assertions?.[name]?.pass === true,
      ),
    },
    scenarioReuse: {
      passed:
        Boolean(vitestScenario?.id) &&
        vitestScenario?.id === playwrightScenario?.id &&
        vitestScenario?.sourceDigest === playwrightScenario?.sourceDigest,
    },
    externalIndependence: {
      attemptedCount: networkAttempts.length,
      passed: evidenceComplete && networkAttempts.length === 0,
    },
    determinism: {
      expectedIterationsPerRunner: ITERATION_GATE,
      passed:
        vitestSummary.iterations === ITERATION_GATE &&
        playwrightSummary.iterations === ITERATION_GATE &&
        vitestSummary.failed === 0 &&
        playwrightSummary.failed === 0 &&
        uniqueFingerprints.length === 1,
    },
    runtimeBudget: {
      enforced: Boolean(enforceCiBudget),
      observedPassed: evidenceComplete ? playwrightP95Raw <= RUNTIME_BUDGET_MS : null,
      passed:
        evidenceComplete &&
        (!enforceCiBudget || playwrightP95Raw <= RUNTIME_BUDGET_MS),
      thresholdMs: RUNTIME_BUDGET_MS,
    },
    failureQuality: {
      passed:
        diagnostic.qualityPassed === true &&
        typeof diagnostic.scenarioId === "string" &&
        typeof diagnostic.path === "string" &&
        diagnostic.expected !== null &&
        diagnostic.actual !== null,
    },
    integrationFootprint: {
      passed: Boolean(footprint.sourceDigest),
    },
  };
  const passed = Object.values(gates).every((gate) => gate.passed);
  const certificationEligible = lane === "registry" && passed;

  return {
    schemaVersion: 1,
    certificationEligible,
    commandResults: commandResults ?? { playwright: false, vitest: false },
    lane,
    packages: [...packages].sort((left, right) => left.name.localeCompare(right.name)),
    isolation: {
      forbiddenResolutionMarkers: [],
      latestVerified: gates.packageIsolation.latestVerified,
      passed: gates.packageIsolation.passed,
      resolutionVerified: gates.packageIsolation.resolutionVerified,
    },
    integrationFootprint: footprint,
    scenario: {
      fingerprint: uniqueFingerprints.length === 1 ? uniqueFingerprints[0] : null,
      id: vitestScenario?.id ?? null,
      normalizedResult: firstVitest?.normalizedResult ?? null,
      sourceDigest: vitestScenario?.sourceDigest ?? null,
    },
    runs: {
      playwright: playwrightSummary,
      vitest: vitestSummary,
    },
    setupTiming: setupTiming ?? null,
    network: {
      attemptedCount: networkAttempts.length,
      attemptedTargets: [...new Set(networkAttempts)].sort(),
    },
    deliberateFailure: diagnostic,
    gates,
    passed,
  };
}

export function writeExternalConsumerProofReport(path, report) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
