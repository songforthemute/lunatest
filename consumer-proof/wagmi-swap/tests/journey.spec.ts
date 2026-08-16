import { expect, test } from "@playwright/test";
import { createLunaCommands, createLunaPageAdapter } from "@lunatest/playwright-plugin";

import { reportSharedScenario, SWAP_SCENARIO_ID } from "./shared-scenario";

test("completes the wagmi journey without outbound traffic", async ({ page }) => {
  const previewOrigin = "http://127.0.0.1:4173";
  const attemptedOutbound: string[] = [];
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.stack ?? error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.origin === previewOrigin
    ) {
      await route.continue();
      return;
    }
    attemptedOutbound.push(url.href);
    await route.abort("blockedbyclient");
  });
  await page.routeWebSocket(/.*/, async (socket) => {
    attemptedOutbound.push(socket.url());
    await socket.close({ code: 1008, reason: "Outbound sockets are blocked" });
  });

  await page.goto("/");
  try {
    await page.getByTestId("stage").waitFor({ state: "attached", timeout: 10_000 });
  } catch {
    throw new Error(
      `Application did not mount:\n${browserErrors.join("\n")}\nBlocked: ${attemptedOutbound.join(", ")}`,
    );
  }
  await expect(page.evaluate(() => Reflect.get(window, "ethereum")?.isLunaTest)).resolves.toBe(true);

  const execution = await createLunaCommands({ cwd: process.cwd() }).assertScenario(
    SWAP_SCENARIO_ID,
    createLunaPageAdapter({
      page,
      async runWhen({ config, page: target }) {
        if (config.when?.action !== "complete_swap") {
          throw new Error(`Unsupported journey action: ${String(config.when?.action)}`);
        }
        await target.getByRole("button", { name: "Connect wallet" }).click();
        await expect(target.getByTestId("stage")).toHaveText("wallet_connected");
        await target.getByRole("button", { name: "Get quote" }).click();
        await expect(target.getByTestId("stage")).toHaveText("approval_required");
        await target.getByRole("button", { name: "Approve token" }).click();
        await expect(target.getByTestId("stage")).toHaveText("ready_to_swap");
        await target.getByRole("button", { name: "Swap token" }).click();
        await expect(target.getByTestId("stage")).toHaveText("swap_confirmed");
      },
      async resolveUi({ page: target }) {
        const approval = await target.getByTestId("approval-hash").textContent();
        const swap = await target.getByTestId("swap-hash").textContent();
        const alert = target.getByRole("alert");
        return {
          stage: await target.getByTestId("stage").textContent(),
          quote: await target.getByTestId("quote").textContent(),
          allowance: await target.getByTestId("allowance").textContent(),
          input_balance: await target.getByTestId("input-balance").textContent(),
          output_balance: await target.getByTestId("output-balance").textContent(),
          approval_submitted: /^Approval: 0x[0-9a-f]{64}$/.test(approval ?? ""),
          swap_submitted: /^Swap: 0x[0-9a-f]{64}$/.test(swap ?? ""),
          ...((await alert.count()) > 0 ? { error: await alert.textContent() } : {}),
        };
      },
      async resolveState({ page: target }) {
        return {
          connected: (await target.getByTestId("account").textContent()) !== "not connected",
          stage: await target.getByTestId("stage").textContent(),
          quote: await target.getByTestId("quote").textContent(),
          allowance: await target.getByTestId("allowance").textContent(),
          input_balance: await target.getByTestId("input-balance").textContent(),
          output_balance: await target.getByTestId("output-balance").textContent(),
        };
      },
      resolveTransitions: ({ page: target }) =>
        target.getByTestId("transition-history").getByRole("listitem").allTextContents(),
    }),
  );

  await reportSharedScenario("playwright", execution.scenario);
  expect(execution.execution.pass).toBe(true);
  expect(attemptedOutbound).toEqual([]);
});
