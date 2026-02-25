import { describe, expect, it } from "vitest";

import { executeCommand } from "../cli";

describe("cli", () => {
  it("runs run command", () => {
    const result = executeCommand(["run"]);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Scenario Summary");
    expect(result.output).toContain("filter=all");
  });

  it("runs watch command", () => {
    const result = executeCommand(["watch"]);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Watch mode");
  });

  it("runs coverage command", () => {
    const result = executeCommand(["coverage"]);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("\"ratio\": 1");
  });

  it("runs gen command with --ai", () => {
    const result = executeCommand(["gen", "--ai"]);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("AI generation complete");
  });

  it("fails gen command without --ai", () => {
    const result = executeCommand(["gen"]);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("requires --ai");
  });

  it("fails unknown command", () => {
    const result = executeCommand(["unknown-command"]);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("unknown command");
  });
});
