import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import * as core from "../../index.js";
import type { ExecuteLuaScenarioAdapter } from "../../runner/execute-scenario.js";

type ProjectRunnerApi = {
  listLunaProjectScenarios: (options: { cwd: string }) => Promise<
    Array<{ id: string; name: string; source: string }>
  >;
  runLunaProjectScenario: (options: {
    cwd: string;
    scenarioId: string;
    adapter: ExecuteLuaScenarioAdapter;
  }) => Promise<{
    scenario: { id: string; source: string };
    execution: { scenarioName: string; pass: boolean; error?: string };
  }>;
  runAllLunaProjectScenarios: (options: {
    cwd: string;
    createAdapter: (scenario: { id: string }) => ExecuteLuaScenarioAdapter;
  }) => Promise<
    Array<{
      scenario: { id: string; source: string };
      execution: { scenarioName: string; pass: boolean };
    }>
  >;
};

function projectRunner(): ProjectRunnerApi {
  return core as unknown as ProjectRunnerApi;
}

describe("project scenario runner", () => {
  it("lists stable project-relative scenario descriptors", async () => {
    const root = await createProjectRoot();

    try {
      const scenarios = await projectRunner().listLunaProjectScenarios({ cwd: root });

      expect(scenarios.map((scenario) => scenario.id)).toEqual([
        "root",
        "scenarios/swap",
      ]);
      expect(scenarios.map((scenario) => scenario.name)).toEqual(["root", "swap"]);
      expect(scenarios.map((scenario) => scenario.source)).toEqual([
        join(root, "root.lua"),
        join(root, "scenarios", "swap.lua"),
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("executes one exact scenario ID with the supplied adapter", async () => {
    const root = await createProjectRoot();
    const calls: string[] = [];

    try {
      const result = await projectRunner().runLunaProjectScenario({
        cwd: root,
        scenarioId: "scenarios/swap",
        adapter: {
          runWhen({ config }) {
            calls.push(`run:${config.name}`);
          },
          resolveUi({ config }) {
            calls.push(`ui:${config.name}`);
            return { quote: { status: "ready" } };
          },
        },
      });

      expect(result.scenario).toMatchObject({
        id: "scenarios/swap",
        source: join(root, "scenarios", "swap.lua"),
      });
      expect(result.execution).toMatchObject({ scenarioName: "swap", pass: true });
      expect(calls).toEqual(["run:swap", "ui:swap"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps a missing UI adapter as an explicit scenario failure", async () => {
    const root = await createProjectRoot();

    try {
      const result = await projectRunner().runLunaProjectScenario({
        cwd: root,
        scenarioId: "root",
        adapter: {},
      });

      expect(result.execution).toMatchObject({
        scenarioName: "root",
        pass: false,
        error: "executor_not_configured",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects an unknown exact scenario ID", async () => {
    const root = await createProjectRoot();

    try {
      await expect(
        projectRunner().runLunaProjectScenario({
          cwd: root,
          scenarioId: "scenarios/missing",
          adapter: { resolveUi: () => ({}) },
        }),
      ).rejects.toThrow('LunaTest scenario ID not found: "scenarios/missing"');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("runs every catalog entry in stable order with a scenario-specific adapter", async () => {
    const root = await createProjectRoot();
    const adapterIds: string[] = [];

    try {
      const results = await projectRunner().runAllLunaProjectScenarios({
        cwd: root,
        createAdapter(scenario) {
          adapterIds.push(scenario.id);
          return {
            resolveUi: () =>
              scenario.id === "root"
                ? { page: { ready: true } }
                : { quote: { status: "ready" } },
          };
        },
      });

      expect(adapterIds).toEqual(["root", "scenarios/swap"]);
      expect(results.map((result) => result.scenario.id)).toEqual([
        "root",
        "scenarios/swap",
      ]);
      expect(results.map((result) => result.execution.pass)).toEqual([true, true]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

async function createProjectRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "lunatest-project-runner-"));
  await mkdir(join(root, "scenarios"), { recursive: true });
  await writeFile(
    join(root, "lunatest.config.json"),
    JSON.stringify({
      luaConfigPath: "root.lua",
      scenarioDir: "scenarios",
    }),
    "utf8",
  );
  await writeFile(
    join(root, "root.lua"),
    `scenario {
      name = "root",
      when = { action = "open" },
      then_ui = { page = { ready = true } }
    }`,
    "utf8",
  );
  await writeFile(
    join(root, "scenarios", "swap.lua"),
    `scenario {
      name = "swap",
      when = { action = "quote" },
      then_ui = { quote = { status = "ready" } }
    }`,
    "utf8",
  );
  return root;
}
