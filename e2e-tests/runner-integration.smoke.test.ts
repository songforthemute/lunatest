import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createLunaCommands, createLunaPageAdapter } from "@lunatest/playwright-plugin";
import { createLunaVitestPlugin } from "@lunatest/vitest-plugin";

type Page = {
  actions: string[];
  quoteStatus: string;
};

const projectRoots: string[] = [];

afterEach(async () => {
  await Promise.all(projectRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("e2e smoke: public scenario runners", () => {
  it("loads one project catalog and executes it through Vitest and page adapters", async () => {
    const root = await createProject();
    const vitest = createLunaVitestPlugin({ cwd: root });

    await expect(vitest.listScenarios()).resolves.toMatchObject([
      { id: "scenarios/quote-ready", name: "quote-ready" },
    ]);
    await expect(
      vitest.assertScenario("scenarios/quote-ready", {
        resolveUi: () => ({ quote: { status: "ready" } }),
      }),
    ).resolves.toMatchObject({ execution: { pass: true } });

    const page: Page = { actions: [], quoteStatus: "idle" };
    const commands = createLunaCommands({ cwd: root });
    const result = await commands.assertScenario(
      "scenarios/quote-ready",
      createLunaPageAdapter({
        page,
        runWhen({ page: target }) {
          target.actions.push("loadQuote");
          target.quoteStatus = "ready";
        },
        resolveUi({ page: target }) {
          return { quote: { status: target.quoteStatus } };
        },
      }),
    );

    expect(result.execution.pass).toBe(true);
    expect(page.actions).toEqual(["loadQuote"]);
  });
});

async function createProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "lunatest-runner-e2e-"));
  projectRoots.push(root);
  await mkdir(join(root, "scenarios"), { recursive: true });
  await writeFile(
    join(root, "lunatest.config.json"),
    JSON.stringify({ scenarioDir: "scenarios", luaConfigPath: "missing-root.lua" }),
    "utf8",
  );
  await writeFile(
    join(root, "scenarios", "quote-ready.lua"),
    `scenario {
      name = "quote-ready",
      given = { quote = { status = "idle" } },
      when = { action = "loadQuote" },
      then_ui = { quote = { status = "ready" } }
    }`,
    "utf8",
  );

  return root;
}
