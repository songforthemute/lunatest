import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadLunaProjectConfig } from "../../index.js";

describe("loadLunaProjectConfig", () => {
  it("loads the default config from the current project root", async () => {
    const root = await createProjectRoot();

    try {
      await writeFile(
        join(root, "lunatest.config.json"),
        JSON.stringify({
          scenarioDir: "test-scenarios",
          luaConfigPath: "config/base.lua",
        }),
        "utf8",
      );

      const project = await loadLunaProjectConfig({ cwd: root });

      expect(project.configPath).toBe(join(root, "lunatest.config.json"));
      expect(project.projectRoot).toBe(root);
      expect(project.resolvedScenarioDir).toBe(join(root, "test-scenarios"));
      expect(project.resolvedLuaConfigPath).toBe(join(root, "config/base.lua"));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("resolves an explicitly selected config and its paths from that config directory", async () => {
    const root = await createProjectRoot();
    const configDirectory = join(root, "fixtures", "project");
    const configPath = join(configDirectory, "lunatest.config.json");

    try {
      await writeFile(
        configPath,
        JSON.stringify({
          scenarioDir: "cases",
          luaConfigPath: "base.lua",
        }),
        "utf8",
      );

      const project = await loadLunaProjectConfig({
        cwd: root,
        configPath: "fixtures/project/lunatest.config.json",
      });

      expect(project.configPath).toBe(configPath);
      expect(project.projectRoot).toBe(configDirectory);
      expect(project.resolvedScenarioDir).toBe(join(configDirectory, "cases"));
      expect(project.resolvedLuaConfigPath).toBe(join(configDirectory, "base.lua"));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps the existing fallback paths when config is optional", async () => {
    const root = await createProjectRoot();

    try {
      const project = await loadLunaProjectConfig({ cwd: root });

      expect(project.configPath).toBeNull();
      expect(project.projectRoot).toBe(root);
      expect(project.config).toEqual({
        scenarioDir: "scenarios",
        luaConfigPath: "lunatest.lua",
      });
      expect(project.resolvedScenarioDir).toBe(join(root, "scenarios"));
      expect(project.resolvedLuaConfigPath).toBe(join(root, "lunatest.lua"));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it.each([
    ["omitted", undefined],
    ["false", false],
  ])("rejects a missing explicitly selected config when requireConfig is %s", async (_, requireConfig) => {
    const root = await createProjectRoot();
    const configPath = join(root, "fixtures", "missing-config.json");

    try {
      await expect(
        loadLunaProjectConfig({
          cwd: root,
          configPath: "fixtures/missing-config.json",
          requireConfig,
        }),
      ).rejects.toThrow(`Selected LunaTest config not found: ${configPath}`);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports the expected config filename when config is required", async () => {
    const root = await createProjectRoot();

    try {
      await expect(loadLunaProjectConfig({ cwd: root, requireConfig: true })).rejects.toThrow(
        "lunatest.config.json",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("names the selected config path when JSON is malformed", async () => {
    const root = await createProjectRoot();
    const configPath = join(root, "broken.json");

    try {
      await writeFile(configPath, "{", "utf8");

      await expect(loadLunaProjectConfig({ cwd: root, configPath })).rejects.toThrow(configPath);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("normalizes coverage and AI configuration like the CLI", async () => {
    const root = await createProjectRoot();

    try {
      await writeFile(
        join(root, "lunatest.config.json"),
        JSON.stringify({
          coverageCatalog: {
            features: ["swap", "", 1],
            states: ["quoted", null],
            components: "quote-panel",
          },
          ai: {
            command: "node",
            args: ["adapter.mjs", 1],
            env: { MODEL: "test", RETRIES: 2 },
          },
        }),
        "utf8",
      );

      const project = await loadLunaProjectConfig({ cwd: root });

      expect(project.config.coverageCatalog).toEqual({
        features: ["swap"],
        states: ["quoted"],
        components: undefined,
      });
      expect(project.config.ai).toEqual({
        command: "node",
        args: ["adapter.mjs"],
        env: { MODEL: "test" },
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

async function createProjectRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "lunatest-project-config-"));
  await writeFile(join(root, ".gitkeep"), "", "utf8");
  await import("node:fs/promises").then(({ mkdir }) => mkdir(join(root, "fixtures", "project"), { recursive: true }));
  return root;
}
