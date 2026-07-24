import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createMcpStdioApp,
  createProjectMcpServer,
  formatMcpStdioError,
  parseMcpStdioArgs,
} from "../bin/mcp-stdio-app";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(async (dir) => {
      await rm(dir, { recursive: true, force: true });
    }),
  );
});

async function createProjectFixture(): Promise<{ projectRoot: string; configPath: string }> {
  const projectRoot = await mkdtemp(join(tmpdir(), "lunatest-mcp-stdio-"));
  tempDirs.push(projectRoot);

  const configPath = join(projectRoot, "lunatest.config.json");
  await mkdir(join(projectRoot, "scenarios"));
  await writeFile(
    configPath,
    JSON.stringify({
      scenarioDir: "scenarios",
      luaConfigPath: "lunatest.lua",
      coverageCatalog: {
        features: ["connect", "swap", "approve"],
        states: ["walletConnected", "quoteLoaded", "approvalRequired"],
        components: ["WalletButton", "SwapForm", "ApproveButton"],
      },
    }),
  );
  await writeFile(
    join(projectRoot, "lunatest.lua"),
    `scenario {
  name = "wallet-ready",
  given = { wallet = { connected = true } },
  when = { action = "connect" },
  then_ui = { wallet = { connected = true } },
  then_state = { wallet = { connected = true } },
  coverage = {
    features = { "connect" },
    states = { "walletConnected" },
    components = { "WalletButton" },
  },
}
`,
  );
  await writeFile(
    join(projectRoot, "scenarios", "swap.lua"),
    `scenario {
  name = "swap-smoke",
  given = {
    wallet = { connected = true },
    quote = { status = "ready" },
  },
  when = { action = "swap" },
  then_ui = {
    wallet = { connected = true },
    quote = { status = "ready" },
  },
  then_state = {
    wallet = { connected = true },
    quote = { status = "ready" },
  },
  coverage = {
    features = { "swap" },
    states = { "quoteLoaded" },
    components = { "SwapForm" },
  },
}
`,
  );

  return { projectRoot, configPath };
}

describe("mcp stdio launcher", () => {
  it("loads the default project scenarios, coverage catalog, and deterministic runner", async () => {
    const { projectRoot } = await createProjectFixture();

    const server = await createProjectMcpServer({ cwd: projectRoot });
    const listed = await server.handleRequest({ id: "list", method: "scenario.list" });
    const report = await server.handleRequest({ id: "coverage", method: "coverage.report" });
    const run = await server.handleRequest({
      id: "run",
      method: "scenario.run",
      params: { id: "scenarios/swap" },
    });

    expect(listed.result).toEqual([
      expect.objectContaining({ id: "lunatest", name: "wallet-ready" }),
      expect.objectContaining({ id: "scenarios/swap", name: "swap-smoke" }),
    ]);
    expect(JSON.stringify(listed.result)).not.toContain(projectRoot);
    expect(report.result).toMatchObject({
      known: {
        features: ["approve", "connect", "swap"],
        states: ["approvalRequired", "quoteLoaded", "walletConnected"],
        components: ["ApproveButton", "SwapForm", "WalletButton"],
      },
      missing: {
        features: ["approve"],
        states: ["approvalRequired"],
        components: ["ApproveButton"],
      },
    });
    expect(run.result).toMatchObject({ id: "scenarios/swap", pass: true });
  });

  it("resolves project files from an explicit config parent instead of the current directory", async () => {
    const { configPath } = await createProjectFixture();
    const otherCwd = await mkdtemp(join(tmpdir(), "lunatest-mcp-other-cwd-"));
    tempDirs.push(otherCwd);

    const server = await createProjectMcpServer({
      cwd: otherCwd,
      configPath,
    });
    const listed = await server.handleRequest({ id: "list", method: "scenario.list" });

    expect(listed.result).toEqual([
      expect.objectContaining({ id: "lunatest" }),
      expect.objectContaining({ id: "scenarios/swap" }),
    ]);
  });

  it("requires the default config while the empty mode deliberately skips discovery", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "lunatest-mcp-missing-config-"));
    tempDirs.push(cwd);

    await expect(createProjectMcpServer({ cwd })).rejects.toThrow(
      `${join(cwd, "lunatest.config.json")}\nUse --empty`,
    );

    const app = await createMcpStdioApp(["--empty"], { cwd });
    expect(app.kind).toBe("server");
    if (app.kind !== "server") {
      throw new Error("Expected an MCP server");
    }

    await expect(
      app.server.handleRequest({ id: "list", method: "scenario.list" }),
    ).resolves.toEqual({ id: "list", result: [] });
  });

  it("parses help and rejects invalid argument combinations before starting stdio", async () => {
    await expect(createMcpStdioApp(["--help"])).resolves.toMatchObject({
      kind: "help",
      usage: expect.stringContaining("Usage: lunatest-mcp"),
    });
    expect(parseMcpStdioArgs([])).toEqual({ mode: "project" });
    expect(parseMcpStdioArgs(["--config", "project/lunatest.config.json"])).toEqual({
      mode: "project",
      configPath: "project/lunatest.config.json",
    });
    expect(() => parseMcpStdioArgs(["--unknown"])).toThrow('Unknown option: --unknown');
    expect(() => parseMcpStdioArgs(["--config"])).toThrow(
      "Option --config requires a path",
    );
    expect(() => parseMcpStdioArgs(["--empty", "--config", "lunatest.config.json"])).toThrow(
      "Option --empty cannot be combined with --config",
    );
  });

  it("formats launcher errors without exposing stack-only paths", () => {
    const error = new Error("Required LunaTest config not found");
    error.stack = `${error.name}: ${error.message}\n    at /private/tmp/project/launcher.ts:12:3`;

    const output = formatMcpStdioError(error);

    expect(output).toBe("Required LunaTest config not found");
    expect(output).not.toContain("/private/tmp/project/launcher.ts");
  });
});
