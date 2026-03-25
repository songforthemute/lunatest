import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadLunaConfig } from "@lunatest/core";

import { executeCommand } from "../cli";
import { loadConfig } from "../config";
import { watchCommand } from "../commands/watch";

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
  given = { wallet = { connected = true } },
  when = { action = "swap" },
  then_ui = { wallet = { connected = true } }
}
`,
    "utf8",
  );

  return file;
}

async function withBrokenLuaScenarioFile(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "lunatest-cli-broken-"));
  tempDirs.push(dir);
  const file = join(dir, "broken.lua");
  await writeFile(file, "this is not lua", "utf8");
  return file;
}

async function withConfiguredProject(): Promise<{
  cwd: string;
  scenarioFile: string;
}> {
  const dir = await mkdtemp(join(tmpdir(), "lunatest-cli-project-"));
  tempDirs.push(dir);

  const scenarioDir = join(dir, "scenarios");
  await mkdir(scenarioDir, { recursive: true });
  const scenarioFile = join(scenarioDir, "swap.lua");
  await writeFile(
    scenarioFile,
    `scenario {
  name = "swap-smoke",
  given = { wallet = { connected = true } },
  when = { action = "swap" },
  then_ui = { quotePanel = { visible = true } },
  coverage = {
    features = { "swap" },
    states = { "quoteLoaded" },
    components = { "quotePanel" },
  }
}
`,
    "utf8",
  );

  const adapterScript = join(dir, "adapter.mjs");
  await writeFile(
    adapterScript,
    `
const chunks = [];
for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
if (!Array.isArray(input.prompts)) throw new Error("prompts missing");
	process.stdout.write(JSON.stringify([
	  {
	    name: "generated-edge-case",
	    lua: "scenario { name = 'generated-edge-case', given = { wallet = { connected = true } }, when = { action = 'swap' }, then_ui = { quotePanel = { visible = true } } }",
	    coverage: { features: ["swap"], states: ["quoteLoaded"], components: ["quotePanel"] },
	    tags: ["generated", "edge-case"]
	  }
	]));
	`,
    "utf8",
  );

  await writeFile(
    join(dir, "lunatest.config.json"),
    JSON.stringify(
      {
        scenarioDir: "scenarios",
        luaConfigPath: "lunatest.lua",
        coverageCatalog: {
          features: ["swap", "approve"],
          states: ["quoteLoaded", "approvalPending"],
          components: ["quotePanel", "actionButtonRow"],
        },
        ai: {
          command: "node",
          args: ["./adapter.mjs"],
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  return { cwd: dir, scenarioFile };
}

describe("cli", () => {
  it("runs run command with scenario path", async () => {
    const file = await withLuaScenarioFile();
    const result = await executeCommand(["run", "--scenario", file]);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Scenario Summary");
    expect(result.output).toContain(`PASS cli-swap source=${file}`);
    expect(result.output).toContain("passed=1");
    expect(result.output).toContain("failed=0");
  });

  it("runs validate command with glob scenario path", async () => {
    const file = await withLuaScenarioFile();
    const result = await executeCommand(["validate", "--scenario", file]);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Validate Summary");
    expect(result.output).toContain(`PASS ${file}`);
  });

  it("runs watch command", async () => {
    const { cwd } = await withConfiguredProject();
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 150);
    const result = await executeCommand(["watch"], {
      cwd,
      signal: controller.signal,
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Scenario Summary");
  });

  it("runs coverage command", async () => {
    const { cwd } = await withConfiguredProject();
    const result = await executeCommand(["coverage"], { cwd });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("\"known\"");
    expect(result.output).toContain("\"missing\"");
  });

  it("runs devtools command with --open", async () => {
    const { cwd } = await withConfiguredProject();
    const result = await executeCommand(["devtools", "--open"], { cwd });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Devtools");
    expect(result.output).toContain("config_path=");
    expect(result.output).toContain("browser_entry=@lunatest/react/browser");
    expect(result.output).toContain("mount_api=mountLunaDevtools()");
  });

  it("runs doctor command", async () => {
    const { cwd } = await withConfiguredProject();
    const result = await executeCommand(["doctor"], { cwd });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Doctor");
    expect(result.output).toContain("config_path=");
    expect(result.output).toContain("ai_adapter=node");
  });

  it("runs gen command with --ai", async () => {
    const { cwd } = await withConfiguredProject();
    const result = await executeCommand(["gen", "--ai"], { cwd });
    const generatedPath = join(cwd, "scenarios", "generated-edge-case.lua");
    const generatedLua = await readFile(generatedPath, "utf8");
    const parsed = (await loadLunaConfig(generatedPath)) as {
      coverage?: { features?: string[] };
      tags?: string[];
    };

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("AI generation complete");
    expect(result.output).toContain("created=1");
    expect(generatedLua).toContain("coverage = {");
    expect(generatedLua).toContain('tags = { "generated", "edge-case" }');
    expect(parsed.coverage?.features).toEqual(["swap"]);
    expect(parsed.tags).toEqual(["generated", "edge-case"]);
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

  it("fails explicit missing scenario path", async () => {
    const result = await executeCommand(["run", "--scenario", "./definitely-missing.lua"]);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("Scenario source not found");
  });

  it("applies filter before executing scenario contents", async () => {
    const file = await withBrokenLuaScenarioFile();
    const result = await executeCommand(["run", "no-match", "--scenario", file]);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("passed=0");
    expect(result.output).toContain("failed=0");
  });

  it("preserves exit code 0 for help output", async () => {
    const result = await executeCommand(["--help"]);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Usage:");
  });

  it("reruns watch when scenario file changes", async () => {
    const { cwd, scenarioFile } = await withConfiguredProject();
    const config = await loadConfig(cwd);
    const controller = new AbortController();
    const updates: string[] = [];

    setTimeout(async () => {
      await writeFile(
        scenarioFile,
        `scenario {
  name = "swap-updated",
  given = { wallet = { connected = true } },
  when = { action = "swap" },
  then_ui = { quotePanel = { visible = true } }
}
`,
        "utf8",
      );
      setTimeout(() => controller.abort(), 250);
    }, 100);

    const output = await watchCommand({
      config,
      signal: controller.signal,
      debounceMs: 50,
      onUpdate(chunk) {
        updates.push(chunk);
      },
    });

    expect(updates.length).toBeGreaterThanOrEqual(2);
    expect(output).toContain("swap-updated");
  });

  it("falls back to polling when recursive watch is unavailable", async () => {
    const { cwd, scenarioFile } = await withConfiguredProject();
    const config = await loadConfig(cwd);
    const controller = new AbortController();
    const updates: string[] = [];

    const idleWatcher = {
      async *[Symbol.asyncIterator]() {
        await new Promise<void>((resolve) => {
          controller.signal.addEventListener("abort", () => resolve(), { once: true });
        });
      },
    };

    setTimeout(async () => {
      await writeFile(
        scenarioFile,
        `scenario {
  name = "swap-polled",
  given = { wallet = { connected = true } },
  when = { action = "swap" },
  then_ui = { quotePanel = { visible = true } }
}
`,
        "utf8",
      );
      setTimeout(() => controller.abort(), 150);
    }, 100);

    const output = await watchCommand({
      config,
      signal: controller.signal,
      debounceMs: 25,
      pollIntervalMs: 25,
      watchImpl(target, watchOptions) {
        if (target === config.resolvedScenarioDir && watchOptions?.recursive) {
          throw new Error("recursive watch unsupported");
        }
        return idleWatcher;
      },
      onUpdate(chunk) {
        updates.push(chunk);
      },
    });

    expect(updates.length).toBeGreaterThanOrEqual(2);
    expect(output).toContain("swap-polled");
  });

  it("keeps watching after a scheduled refresh hits invalid lua", async () => {
    const { cwd, scenarioFile } = await withConfiguredProject();
    const config = await loadConfig(cwd);
    const controller = new AbortController();
    const updates: string[] = [];

    setTimeout(async () => {
      await writeFile(scenarioFile, "scenario {", "utf8");
      setTimeout(async () => {
        await writeFile(
          scenarioFile,
          `scenario {
  name = "swap-recovered",
  given = { wallet = { connected = true } },
  when = { action = "swap" },
  then_ui = { quotePanel = { visible = true } }
}
`,
          "utf8",
        );
        setTimeout(() => controller.abort(), 200);
      }, 120);
    }, 100);

    const output = await watchCommand({
      config,
      signal: controller.signal,
      debounceMs: 25,
      pollIntervalMs: 25,
      onUpdate(chunk) {
        updates.push(chunk);
      },
    });

    expect(output).toContain("status=error");
    expect(output).toContain("swap-recovered");
    expect(updates.some((chunk) => chunk.includes("status=error"))).toBe(true);
    expect(updates.some((chunk) => chunk.includes("swap-recovered"))).toBe(true);
  });

  it("fails gen when AI adapter returns invalid JSON", async () => {
    const { cwd } = await withConfiguredProject();
    await writeFile(
      join(cwd, "adapter.mjs"),
      `process.stdout.write("not-json");`,
      "utf8",
    );

    const result = await executeCommand(["gen", "--ai"], { cwd });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("Unexpected token");
  });
});
