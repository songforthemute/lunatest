import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import * as pluginApi from "../index.js";
import { createLunaCommands } from "../commands.js";

type Page = {
  events: string[];
};

type LunaCommandApi = {
  listScenarios: () => Promise<Array<{ id: string }>>;
  runScenario: (
    scenarioId: string,
    adapter: unknown,
  ) => Promise<{
    scenario: { id: string };
    execution: { pass: boolean };
  }>;
  assertScenario: (scenarioId: string, adapter: unknown) => Promise<void>;
  runAll: (createAdapter: (scenario: { id: string }) => unknown) => Promise<unknown[]>;
};

type LunaCommandFactory = (options: { cwd: string }) => LunaCommandApi;

type LunaPageAdapterFactory = (options: {
  page: Page;
  runWhen: (context: { page: Page; runtime: { getInterceptState: () => Record<string, unknown> } }) => void;
  resolveUi: (context: { page: Page }) => Record<string, unknown>;
}) => unknown;

function commands(options: { cwd: string }): LunaCommandApi {
  return (createLunaCommands as unknown as LunaCommandFactory)(options);
}

function pageAdapterFactory(): LunaPageAdapterFactory {
  const api = pluginApi as typeof pluginApi & {
    createLunaPageAdapter?: LunaPageAdapterFactory;
  };

  expect(typeof api.createLunaPageAdapter).toBe("function");
  return api.createLunaPageAdapter as LunaPageAdapterFactory;
}

describe("Playwright scenario commands", () => {
  it("executes an exact scenario through a page-bound adapter", async () => {
    const root = await createProjectRoot();
    const page: Page = { events: [] };

    try {
      const result = await commands({ cwd: root }).runScenario(
        "scenarios/pass",
        pageAdapterFactory()({
          page,
          runWhen({ page: target, runtime }) {
            target.events.push(`action:${String(runtime.getInterceptState().quote)}`);
          },
          resolveUi({ page: target }) {
            target.events.push("read");
            return { quote: { status: "ready" } };
          },
        }),
      );

      expect(result).toMatchObject({
        scenario: { id: "scenarios/pass" },
        execution: { pass: true },
      });
      expect(page.events).toEqual(["action:[object Object]", "read"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("throws scenario identity, source, and diff when a page assertion fails", async () => {
    const root = await createProjectRoot();
    const page: Page = { events: [] };

    try {
      await expect(
        commands({ cwd: root }).assertScenario(
          "scenarios/fail",
          pageAdapterFactory()({
            page,
            runWhen: () => undefined,
            resolveUi: () => ({ quote: { status: "loading" } }),
          }),
        ),
      ).rejects.toThrow(/scenarios\/fail[\s\S]*scenarios[\\/]fail\.lua[\s\S]*quote/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("creates one page adapter per scenario when running the full catalog", async () => {
    const root = await createProjectRoot();
    const adapterIds: string[] = [];

    try {
      const results = await commands({ cwd: root }).runAll((scenario) => {
        adapterIds.push(scenario.id);
        return pageAdapterFactory()({
          page: { events: [] },
          runWhen: () => undefined,
          resolveUi: () => ({ quote: { status: "ready" } }),
        });
      });

      expect(adapterIds).toEqual(["scenarios/fail", "scenarios/pass"]);
      expect(results).toHaveLength(2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

async function createProjectRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "lunatest-playwright-commands-"));
  await mkdir(join(root, "scenarios"), { recursive: true });
  await writeFile(
    join(root, "lunatest.config.json"),
    JSON.stringify({ scenarioDir: "scenarios", luaConfigPath: "missing-root.lua" }),
    "utf8",
  );

  for (const name of ["pass", "fail"]) {
    await writeFile(
      join(root, "scenarios", `${name}.lua`),
      `scenario {
        name = "${name}",
        given = { quote = { status = "loading" } },
        when = { action = "quote" },
        then_ui = { quote = { status = "ready" } }
      }`,
      "utf8",
    );
  }

  return root;
}
