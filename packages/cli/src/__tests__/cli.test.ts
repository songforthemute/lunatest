import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { executeCommand } from "../cli";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(async (dir) => {
      await rm(dir, { recursive: true, force: true });
    }),
  );
});

async function withLuaScenarioFile(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "lunatest-cli-"));
  tempDirs.push(dir);
  const file = join(dir, "sample.lua");
  await writeFile(
    file,
    `scenario {
  name = "cli-swap",
  mode = "strict",
  given = { wallet = { connected = true } }
}
`,
    "utf8",
  );

  return file;
}

describe("cli", () => {
  it("runs run command with scenario path", async () => {
    const file = await withLuaScenarioFile();
    const result = await executeCommand(["run", "--scenario", file]);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Scenario Summary");
    expect(result.output).toContain(`source=${file}`);
    expect(result.output).toContain("name=cli-swap");
  });

  it("runs watch command", async () => {
    const result = await executeCommand(["watch"]);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Watch mode");
  });

  it("runs coverage command", async () => {
    const result = await executeCommand(["coverage"]);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("\"ratio\": 1");
  });

  it("runs devtools command with --open", async () => {
    const result = await executeCommand(["devtools", "--open"]);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("widget=LunaDevtoolsPanel");
  });

  it("runs doctor command", async () => {
    const result = await executeCommand(["doctor"]);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Doctor");
  });

  it("runs gen command with --ai", async () => {
    const result = await executeCommand(["gen", "--ai"]);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("AI generation complete");
  });

  it("fails gen command without --ai", async () => {
    const result = await executeCommand(["gen"]);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("requires --ai");
  });

  it("fails devtools command without --open", async () => {
    const result = await executeCommand(["devtools"]);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("requires --open");
  });

  it("fails unknown command", async () => {
    const result = await executeCommand(["unknown-command"]);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("unknown command");
  });
});
