import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

import {
  createLunaCommands,
  createLunaFixture,
  createLunaPageAdapter,
} from "@lunatest/playwright-plugin";

const projectRoots: string[] = [];

test.afterEach(async () => {
  await Promise.all(projectRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

test("runs a Lua scenario against an actual Chromium page", async ({ page }) => {
  const root = await createProject();
  await page.setContent(`
    <button data-testid="load-quote">Load quote</button>
    <output data-testid="quote-status">idle</output>
    <script>
      document.querySelector('[data-testid="load-quote"]').addEventListener('click', () => {
        document.querySelector('[data-testid="quote-status"]').textContent = 'ready';
      });
    </script>
  `);

  const commands = createLunaCommands({ cwd: root });
  const result = await commands.assertScenario(
    "scenarios/quote-ready",
    createLunaPageAdapter({
      page,
      runWhen: ({ page: target }) => target.getByTestId("load-quote").click(),
      resolveUi: async ({ page: target }) => ({
        quote: {
          status: (await target.getByTestId("quote-status").textContent())?.trim(),
        },
      }),
    }),
  );

  expect(result.execution.pass).toBe(true);
  await expect(page.getByTestId("quote-status")).toHaveText("ready");
});

test("routes configured RPC and blocks unknown requests in a real browser", async ({ page }) => {
  const fixture = createLunaFixture({
    routing: {
      mode: "strict",
      rpcEndpoints: [
        {
          urlPattern: "https://rpc.test",
          methods: ["eth_chainId"],
          responseKey: "chainId",
        },
      ],
    },
    mockResponses: {
      chainId: { result: "0x1" },
    },
  });
  await fixture.installRouting(page);

  const chainId = await page.evaluate(async () => {
    const response = await fetch("https://rpc.test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "eth_chainId",
        params: [],
      }),
    });
    return (await response.json()) as { result: string };
  });
  const blocked = await page.evaluate(async () => {
    try {
      await fetch("https://unknown.test");
      return false;
    } catch {
      return true;
    }
  });

  expect(chainId).toEqual({ id: 1, jsonrpc: "2.0", result: "0x1" });
  expect(blocked).toBe(true);
});

async function createProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "lunatest-browser-runner-"));
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
