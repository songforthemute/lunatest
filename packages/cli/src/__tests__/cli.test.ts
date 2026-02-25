import { describe, expect, it } from "vitest";

import { executeCommand } from "../cli";

describe("cli", () => {
  it("runs run command", () => {
    const result = executeCommand(["run"]);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Scenario Summary");
  });

  it("runs watch command", () => {
    const result = executeCommand(["watch"]);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Watch mode");
  });

  it("runs coverage command", () => {
    const result = executeCommand(["coverage"]);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Coverage report");
  });
});
