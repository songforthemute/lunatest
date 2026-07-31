import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import * as api from "../index.js";
import { createLunaVitestPlugin } from "../plugin.js";
import { toLunaPass } from "../matchers.js";

type Adapter = {
  resolveUi: () => Record<string, unknown>;
};

type LunaVitestRunner = {
  listScenarios: () => Promise<Array<{ id: string }>>;
  runScenario: (
    scenarioId: string,
    adapter: Adapter,
  ) => Promise<{
    scenario: { id: string };
    execution: { pass: boolean; result?: { diff: string } };
  }>;
  assertScenario: (scenarioId: string, adapter: Adapter) => Promise<void>;
};

type LunaVitestPluginFactory = (options: { cwd: string; scenarioDir?: string }) => LunaVitestRunner;

function createRunner(options: { cwd: string; scenarioDir?: string }): LunaVitestRunner {
  return (createLunaVitestPlugin as unknown as LunaVitestPluginFactory)(options);
}

describe("Vitest scenario runner", () => {
  it("lists and executes scenarios through the supplied adapter", async () => {
    const root = await createProjectRoot();

    try {
      const runner = createRunner({ cwd: root });

      await expect(runner.listScenarios()).resolves.toMatchObject([
        { id: "scenarios/fail" },
        { id: "scenarios/pass" },
      ]);
      await expect(
        runner.runScenario("scenarios/pass", {
          resolveUi: () => ({ quote: { status: "ready" } }),
        }),
      ).resolves.toMatchObject({
        scenario: { id: "scenarios/pass" },
        execution: { pass: true },
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("throws the scenario ID, source, and assertion diff from assertScenario", async () => {
    const root = await createProjectRoot();

    try {
      const runner = createRunner({ cwd: root });

      await expect(
        runner.assertScenario("scenarios/fail", {
          resolveUi: () => ({ quote: { status: "loading" } }),
        }),
      ).rejects.toThrow(/scenarios\/fail[\s\S]*scenarios[\\/]fail\.lua[\s\S]*quote/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("includes a Luna assertion diff in the matcher failure message", () => {
    const matcher = toLunaPass({
      pass: false,
      result: { diff: "[ui] quote.status: expected ready, received loading" },
    });

    expect(matcher.pass).toBe(false);
    expect(matcher.message()).toContain("quote.status");
  });

  it("exposes a caller-scoped watch trigger without mutating Vitest configuration", () => {
    const watchApi = api as typeof api & {
      createLunaVitestWatchTrigger?: (options: {
        cwd: string;
        scenarioDir: string;
        testFiles: string[];
      }) => {
        pattern: RegExp;
        testsToRun: (id: string) => string[];
      };
    };

    expect(typeof watchApi.createLunaVitestWatchTrigger).toBe("function");
    const trigger = watchApi.createLunaVitestWatchTrigger?.({
      cwd: "/project",
      scenarioDir: "scenarios",
      testFiles: ["tests/luna.test.ts"],
    });

    expect(trigger?.pattern.test("/project/scenarios/swap.lua")).toBe(true);
    expect(trigger?.testsToRun("/project/scenarios/swap.lua")).toEqual([
      "tests/luna.test.ts",
    ]);
    expect(() =>
      watchApi.createLunaVitestWatchTrigger?.({
        cwd: "/project",
        scenarioDir: "scenarios",
        testFiles: [],
      }),
    ).toThrow("at least one harness test file");
  });
});

async function createProjectRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "lunatest-vitest-runner-"));
  await mkdir(join(root, "scenarios"), { recursive: true });
  await writeFile(
    join(root, "lunatest.config.json"),
    JSON.stringify({ scenarioDir: "scenarios", luaConfigPath: "missing-root.lua" }),
    "utf8",
  );
  await writeFile(
    join(root, "scenarios", "pass.lua"),
    `scenario {
      name = "pass",
      when = { action = "quote" },
      then_ui = { quote = { status = "ready" } }
    }`,
    "utf8",
  );
  await writeFile(
    join(root, "scenarios", "fail.lua"),
    `scenario {
      name = "fail",
      when = { action = "quote" },
      then_ui = { quote = { status = "ready" } }
    }`,
    "utf8",
  );
  return root;
}
