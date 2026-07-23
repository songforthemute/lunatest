import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  loadLunaProjectConfig,
  loadLunaProjectScenarios,
  resolveLunaScenarioSources,
} from "../../index.js";

describe("project scenario loading", () => {
  it("discovers default sources in sorted order and creates project-relative records", async () => {
    const root = await createProjectRoot();
    const luaConfigPath = join(root, "scenarios", "lunatest.lua");

    try {
      await writeFile(
        join(root, "lunatest.config.json"),
        JSON.stringify({ luaConfigPath: "scenarios/lunatest.lua" }),
        "utf8",
      );
      await writeFile(luaConfigPath, baseScenario("project-default"), "utf8");
      await writeFile(
        join(root, "scenarios", "swap.lua"),
        `scenario {
          name = "swap",
          given = { wallet = { connected = true } },
          when = { action = "swap" },
          then_ui = { quotePanel = { visible = true } },
          coverage = {
            features = { "swap" },
            states = { "quoteLoaded" },
            components = { "quotePanel" }
          }
        }`,
        "utf8",
      );

      const project = await loadLunaProjectConfig({ cwd: root });
      const sources = await resolveLunaScenarioSources({
        luaConfigPath: project.resolvedLuaConfigPath,
        scenarioDir: project.resolvedScenarioDir,
      });
      const items = await loadLunaProjectScenarios({ config: project });

      expect(sources).toEqual([luaConfigPath, join(root, "scenarios", "swap.lua")]);
      expect(sources.filter((source) => source === luaConfigPath)).toHaveLength(1);
      expect(items.map((item) => item.id)).toEqual(["scenarios/lunatest", "scenarios/swap"]);
      expect(items.filter((item) => item.source === luaConfigPath)).toHaveLength(1);
      expect(items.map((item) => item.name)).toEqual(["project-default", "swap"]);
      expect(items[1]?.coverage).toEqual({
        features: ["swap"],
        states: ["quoteLoaded"],
        components: ["quotePanel"],
      });
      expect(items.map((item) => item.id).join("\n")).not.toContain(root);
      expect(items[1]?.lua).toContain('name = "swap"');
      expect(items[1]?.config.when?.action).toBe("swap");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports missing explicit sources and empty globs", async () => {
    const root = await createProjectRoot();

    try {
      await expect(
        resolveLunaScenarioSources({
          scenario: join(root, "missing.lua"),
          luaConfigPath: join(root, "lunatest.lua"),
          scenarioDir: join(root, "scenarios"),
        }),
      ).rejects.toThrow(`Scenario source not found: ${join(root, "missing.lua")}`);

      await expect(
        resolveLunaScenarioSources({
          scenario: join(root, "scenarios", "*.lua"),
          luaConfigPath: join(root, "lunatest.lua"),
          scenarioDir: join(root, "scenarios"),
        }),
      ).rejects.toThrow(`Scenario glob matched no files: ${join(root, "scenarios", "*.lua")}`);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

function baseScenario(name: string): string {
  return `scenario {
    name = "${name}",
    given = {},
    when = { action = "open" },
    then_ui = { page = { ready = true } }
  }`;
}

async function createProjectRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "lunatest-project-scenarios-"));
  await mkdir(join(root, "scenarios"), { recursive: true });
  return root;
}
