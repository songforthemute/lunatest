import { describe, expect, it } from "vitest";

import {
  toConsoleReport,
  toHtmlReport,
  toJsonReport,
  toJunitReport,
} from "../reporter";
import type { RunAllResult } from "../runner";

const sampleResult: RunAllResult = {
  total: 2,
  passed: 1,
  failed: 1,
  results: [
    {
      scenarioName: "happy-path",
      pass: true,
      diff: "",
      expectedUi: { warning: false },
      actualUi: { warning: false },
      assertions: {
        ui: {
          pass: true,
          diff: "",
          expected: { warning: false },
          actual: { warning: false },
        },
      },
    },
    {
      scenarioName: "warning-case",
      pass: false,
      diff: "[ui] expected true but got false",
      expectedUi: { warning: true },
      actualUi: { warning: false },
      assertions: {
        ui: {
          pass: false,
          diff: "expected true but got false",
          expected: { warning: true },
          actual: { warning: false },
        },
      },
    },
  ],
};

describe("reporter", () => {
  it("renders console report", () => {
    const report = toConsoleReport(sampleResult);
    expect(report).toContain("Scenario Summary");
    expect(report).toContain("PASS happy-path");
    expect(report).toContain("FAIL warning-case");
  });

  it("renders json report", () => {
    const report = toJsonReport(sampleResult);
    expect(report).toContain("\"total\": 2");
    expect(report).toContain("\"scenarioName\": \"warning-case\"");
  });

  it("renders junit report", () => {
    const report = toJunitReport(sampleResult);
    expect(report).toContain("<testsuite");
    expect(report).toContain("<testcase");
    expect(report).toContain("<failure");
  });

  it("renders html report", () => {
    const report = toHtmlReport(sampleResult);
    expect(report).toContain("<!doctype html>");
    expect(report).toContain("<table");
    expect(report).toContain("warning-case");
  });
});
