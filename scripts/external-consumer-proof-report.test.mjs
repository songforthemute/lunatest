import assert from "node:assert/strict";
import test from "node:test";

import {
  createExternalConsumerProofReport,
  median,
  nearestRankPercentile,
} from "./external-consumer-proof-report.mjs";
import { packageNames, publicPackages } from "./package-roster.mjs";

function proofPackages(source) {
  return packageNames(publicPackages).map((name, index) => ({
    name,
    source,
    version: `1.0.${index}`,
  }));
}

test("proof statistics use even median and nearest-rank p95", () => {
  const samples = Array.from({ length: 30 }, (_, index) => index + 1);
  assert.equal(median(samples), 15.5);
  assert.equal(nearestRankPercentile(samples, 0.95), 29);
});

test("proof report enforces 30 deterministic cross-runner results", () => {
  const run = {
    durationMs: 5,
    fingerprint: "sha256:fingerprint",
    networkAttempts: [],
    normalizedResult: {
      assertions: Object.fromEntries(
        ["negative", "state", "transition", "ui"].map((name) => [name, { pass: true }]),
      ),
      pass: true,
      scenario: {
        id: "scenarios/approve-and-swap",
        sourceDigest: "sha256:source",
      },
    },
  };
  const fragment = {
    measuredRuns: Array.from({ length: 30 }, () => ({ ...run })),
    warmupRuns: 1,
  };
  const report = createExternalConsumerProofReport({
    commandResults: { playwright: true, vitest: true },
    enforceCiBudget: true,
    footprint: { sourceDigest: "sha256:footprint" },
    lane: "pack",
    packages: proofPackages("packed-tarball"),
    playwright: fragment,
    vitest: {
      ...fragment,
      deliberateFailure: {
        actual: "1799",
        expected: "1800",
        path: "then_ui.output_balance",
        qualityPassed: true,
        scenarioId: "scenarios/approve-and-swap",
      },
    },
  });

  assert.equal(report.passed, true);
  assert.equal(report.certificationEligible, false);
  assert.equal(report.runs.playwright.medianMs, 5);
  assert.equal(report.runs.playwright.p95Ms, 5);
  assert.equal(report.gates.determinism.passed, true);
  assert.equal(report.gates.failureQuality.passed, true);
  assert.equal(JSON.stringify(report).includes("/private/"), false);
});

test("registry proof becomes certification eligible only with passing npm evidence", () => {
  const run = {
    durationMs: 5,
    fingerprint: "sha256:fingerprint",
    networkAttempts: [],
    normalizedResult: {
      assertions: Object.fromEntries(
        ["negative", "state", "transition", "ui"].map((name) => [name, { pass: true }]),
      ),
      pass: true,
      scenario: {
        id: "scenarios/approve-and-swap",
        sourceDigest: "sha256:source",
      },
    },
  };
  const fragment = {
    measuredRuns: Array.from({ length: 30 }, () => ({ ...run })),
    warmupRuns: 1,
  };
  const report = createExternalConsumerProofReport({
    commandResults: { playwright: true, vitest: true },
    enforceCiBudget: true,
    footprint: { sourceDigest: "sha256:footprint" },
    lane: "registry",
    packages: proofPackages("npm-registry"),
    playwright: fragment,
    registryEvidence: { latestVerified: true, resolutionVerified: true },
    vitest: {
      ...fragment,
      deliberateFailure: {
        actual: "1799",
        expected: "1800",
        path: "then_ui.output_balance",
        qualityPassed: true,
        scenarioId: "scenarios/approve-and-swap",
      },
    },
  });

  assert.equal(report.passed, true);
  assert.equal(report.certificationEligible, true);
  assert.equal(report.gates.packageIsolation.expectedSource, "npm-registry");
});

test("registry proof rejects incomplete or non-registry package evidence", () => {
  const runs = Array.from({ length: 30 }, () => ({
    durationMs: 5,
    fingerprint: "sha256:stable",
    networkAttempts: [],
    normalizedResult: {
      assertions: Object.fromEntries(
        ["negative", "state", "transition", "ui"].map((name) => [name, { pass: true }]),
      ),
      pass: true,
      scenario: { id: "scenario", sourceDigest: "sha256:source" },
    },
  }));
  const fragment = { measuredRuns: runs, warmupRuns: 1 };
  const report = createExternalConsumerProofReport({
    commandResults: { playwright: true, vitest: true },
    enforceCiBudget: true,
    footprint: { sourceDigest: "sha256:footprint" },
    lane: "registry",
    packages: proofPackages("npm-registry").slice(0, -1),
    playwright: fragment,
    registryEvidence: { latestVerified: true, resolutionVerified: true },
    vitest: {
      ...fragment,
      deliberateFailure: {
        actual: "1799",
        expected: "1800",
        path: "then_ui.output_balance",
        qualityPassed: true,
        scenarioId: "scenario",
      },
    },
  });

  assert.equal(report.passed, false);
  assert.equal(report.certificationEligible, false);
  assert.equal(report.gates.packageIsolation.passed, false);

  const wrongSource = createExternalConsumerProofReport({
    commandResults: { playwright: true, vitest: true },
    enforceCiBudget: true,
    footprint: { sourceDigest: "sha256:footprint" },
    lane: "registry",
    packages: proofPackages("packed-tarball"),
    playwright: fragment,
    registryEvidence: { latestVerified: true, resolutionVerified: true },
    vitest: {
      ...fragment,
      deliberateFailure: {
        actual: "1799",
        expected: "1800",
        path: "then_ui.output_balance",
        qualityPassed: true,
        scenarioId: "scenario",
      },
    },
  });
  assert.equal(wrongSource.certificationEligible, false);
  assert.equal(wrongSource.gates.packageIsolation.passed, false);
});

test("proof report fails flake, network, and runtime gates", () => {
  const runs = Array.from({ length: 30 }, (_, index) => ({
    durationMs: index >= 28 ? 10_001 : 5,
    fingerprint: index === 29 ? "sha256:flake" : "sha256:stable",
    networkAttempts: index === 0 ? ["http:https://rpc.example/"] : [],
    normalizedResult: {
      assertions: Object.fromEntries(
        ["negative", "state", "transition", "ui"].map((name) => [name, { pass: true }]),
      ),
      pass: true,
      scenario: { id: "scenario", sourceDigest: "sha256:source" },
    },
  }));
  const report = createExternalConsumerProofReport({
    commandResults: { playwright: true, vitest: true },
    enforceCiBudget: true,
    footprint: { sourceDigest: "sha256:footprint" },
    lane: "pack",
    packages: [],
    playwright: { measuredRuns: runs, warmupRuns: 1 },
    vitest: { measuredRuns: runs, warmupRuns: 1, deliberateFailure: {} },
  });

  assert.equal(report.passed, false);
  assert.equal(report.gates.determinism.passed, false);
  assert.equal(report.gates.externalIndependence.passed, false);
  assert.equal(report.gates.runtimeBudget.passed, false);
  assert.equal(report.gates.failureQuality.passed, false);
});

test("proof report remains schema-complete when a runner command fails", () => {
  const report = createExternalConsumerProofReport({
    commandResults: { playwright: false, vitest: true },
    enforceCiBudget: true,
    footprint: { sourceDigest: "sha256:footprint" },
    lane: "pack",
    packages: [],
    playwright: { measuredRuns: [], runner: "playwright", warmupRuns: 0 },
    vitest: { measuredRuns: [], runner: "vitest", warmupRuns: 0 },
  });

  assert.equal(report.passed, false);
  assert.equal(report.gates.runnerCommands.passed, false);
  assert.equal(report.gates.externalIndependence.passed, false);
  assert.equal(report.gates.runtimeBudget.observedPassed, null);
  assert.equal(report.gates.runtimeBudget.passed, false);
  assert.equal(report.runs.playwright.iterations, 0);
  assert.deepEqual(report.commandResults, { playwright: false, vitest: true });
});

test("runtime budget gates on the raw p95 before report rounding", () => {
  const runs = Array.from({ length: 30 }, (_, index) => ({
    durationMs: index >= 28 ? 10_000.0004 : 5,
    fingerprint: "sha256:stable",
    networkAttempts: [],
    normalizedResult: {
      assertions: Object.fromEntries(
        ["negative", "state", "transition", "ui"].map((name) => [name, { pass: true }]),
      ),
      pass: true,
      scenario: { id: "scenario", sourceDigest: "sha256:source" },
    },
  }));
  const fragment = { measuredRuns: runs, networkAttempts: [], warmupRuns: 1 };
  const report = createExternalConsumerProofReport({
    commandResults: { playwright: true, vitest: true },
    enforceCiBudget: true,
    footprint: { sourceDigest: "sha256:footprint" },
    lane: "pack",
    packages: [],
    playwright: fragment,
    vitest: { ...fragment, deliberateFailure: {} },
  });

  assert.equal(report.runs.playwright.p95Ms, 10_000);
  assert.equal(report.gates.runtimeBudget.observedPassed, false);
  assert.equal(report.gates.runtimeBudget.passed, false);
});
