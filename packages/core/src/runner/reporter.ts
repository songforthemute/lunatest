import type { RunAllResult, RunScenarioResult } from "./runner";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

function scenarioLine(result: RunScenarioResult): string {
  return `${result.pass ? "PASS" : "FAIL"} ${result.scenarioName}`;
}

export function toConsoleReport(result: RunAllResult): string {
  const lines = [
    "Scenario Summary",
    `total=${result.total}`,
    `passed=${result.passed}`,
    `failed=${result.failed}`,
  ];

  for (const item of result.results) {
    lines.push(scenarioLine(item));
    if (!item.pass && item.diff) {
      lines.push(item.diff);
    }
  }

  return lines.join("\n");
}

export function toJsonReport(result: RunAllResult): string {
  return JSON.stringify(result, null, 2);
}

export function toJunitReport(result: RunAllResult): string {
  const testcases = result.results
    .map((item) => {
      if (item.pass) {
        return `<testcase classname="lunatest" name="${escapeXml(item.scenarioName)}" />`;
      }

      return [
        `<testcase classname="lunatest" name="${escapeXml(item.scenarioName)}">`,
        `<failure message="${escapeXml(item.diff || "assertion failed")}" />`,
        "</testcase>",
      ].join("");
    })
    .join("");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuite name="lunatest" tests="${result.total}" failures="${result.failed}">`,
    testcases,
    "</testsuite>",
  ].join("");
}

export function toHtmlReport(result: RunAllResult): string {
  const rows = result.results
    .map((item) => {
      const status = item.pass ? "PASS" : "FAIL";
      const diff = item.diff ? item.diff : "";
      return `<tr><td>${escapeXml(item.scenarioName)}</td><td>${status}</td><td>${escapeXml(diff)}</td></tr>`;
    })
    .join("");

  return [
    "<!doctype html>",
    "<html><head><meta charset=\"utf-8\" /><title>LunaTest Report</title></head>",
    "<body>",
    "<h1>LunaTest Report</h1>",
    `<p>total=${result.total}, passed=${result.passed}, failed=${result.failed}</p>`,
    "<table border=\"1\" cellspacing=\"0\" cellpadding=\"6\">",
    "<thead><tr><th>Scenario</th><th>Status</th><th>Diff</th></tr></thead>",
    `<tbody>${rows}</tbody>`,
    "</table>",
    "</body></html>",
  ].join("");
}
