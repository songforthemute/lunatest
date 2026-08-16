import { expect, test } from "@playwright/test";

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
  await expect(page.getByTestId("stage")).toHaveText("disconnected");
  await expect(page.evaluate(() => Reflect.get(window, "ethereum")?.isLunaTest)).resolves.toBe(true);

  await page.getByRole("button", { name: "Connect wallet" }).click();
  await expect(page.getByTestId("stage")).toHaveText("wallet_connected");

  await page.getByRole("button", { name: "Get quote" }).click();
  await expect(page.getByTestId("stage")).toHaveText("approval_required");
  await expect(page.getByTestId("quote")).toHaveText("1800");

  await page.getByRole("button", { name: "Approve token" }).click();
  await expect(page.getByTestId("stage")).toHaveText("ready_to_swap");
  await expect(page.getByTestId("allowance")).toHaveText("1");
  await expect(page.getByTestId("approval-hash")).toContainText(/^Approval: 0x[0-9a-f]{64}$/);

  await page.getByRole("button", { name: "Swap token" }).click();
  await expect(page.getByTestId("stage")).toHaveText("swap_confirmed");
  await expect(page.getByTestId("input-balance")).toHaveText("24");
  await expect(page.getByTestId("output-balance")).toHaveText("1800");
  await expect(page.getByTestId("swap-hash")).toContainText(/^Swap: 0x[0-9a-f]{64}$/);
  await expect(page.getByTestId("transition-history").getByRole("listitem")).toHaveText([
    "disconnected",
    "wallet_connected",
    "quote_ready",
    "approval_required",
    "approval_pending",
    "ready_to_swap",
    "swap_pending",
    "swap_confirmed",
  ]);
  expect(attemptedOutbound).toEqual([]);
});
