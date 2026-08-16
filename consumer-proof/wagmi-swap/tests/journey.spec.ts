import { performance } from "node:perf_hooks";

import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { createLunaCommands, createLunaPageAdapter } from "@lunatest/playwright-plugin";

import {
  createProofRun,
  proofIterationCount,
  sanitizeNetworkTarget,
  writeProofFragment,
  type JourneyEvidence,
  type ProofRun,
} from "./proof-metrics";
import { reportSharedScenario, SWAP_SCENARIO_ID } from "./shared-scenario";

const PREVIEW_ORIGIN = "http://127.0.0.1:4173";

test("completes the wagmi journey without outbound traffic", async ({ browser }) => {
  test.setTimeout(360_000);
  const iterations = proofIterationCount();
  const allNetworkAttempts: string[] = [];
  const measuredRuns: ProofRun[] = [];
  const commands = createLunaCommands({ cwd: process.cwd() });
  let sharedScenarioReported = false;

  for (let index = iterations > 1 ? -1 : 0; index < iterations; index += 1) {
    const { execution, proofRun } = await runRenderedJourney(browser, commands);
    allNetworkAttempts.push(...proofRun.networkAttempts);
    if (index < 0) continue;
    measuredRuns.push(proofRun);
    if (!sharedScenarioReported) {
      await reportSharedScenario("playwright", execution.scenario);
      sharedScenarioReported = true;
    }
  }

  await writeProofFragment("playwright", {
    measuredRuns,
    networkAttempts: allNetworkAttempts,
    runner: "playwright",
    warmupRuns: iterations > 1 ? 1 : 0,
  });

  expect(measuredRuns).toHaveLength(iterations);
  expect(allNetworkAttempts).toEqual([]);
  expect(measuredRuns.every((run) => run.normalizedResult.pass === true)).toBe(true);
});

async function runRenderedJourney(
  browser: Browser,
  commands: ReturnType<typeof createLunaCommands>,
) {
  const attemptedOutbound: string[] = [];
  const browserErrors: string[] = [];
  const context = await browser.newContext({
    baseURL: PREVIEW_ORIGIN,
    serviceWorkers: "block",
  });
  await installBrowserNetworkGuard(context, attemptedOutbound);
  const page = await context.newPage();
  page.on("pageerror", (error) => browserErrors.push(error.stack ?? error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

  try {
    await page.goto("/");
    try {
      await page.getByTestId("stage").waitFor({ state: "attached", timeout: 10_000 });
    } catch {
      throw new Error(
        `Application did not mount:\n${browserErrors.join("\n")}\nBlocked: ${attemptedOutbound.join(", ")}`,
      );
    }
    await expect(page.evaluate(() => Reflect.get(window, "ethereum")?.isLunaTest)).resolves.toBe(
      true,
    );

    const started = performance.now();
    const execution = await commands.runScenario(
      SWAP_SCENARIO_ID,
      createJourneyPageAdapter(page),
    );
    const durationMs = performance.now() - started;
    const evidence = await readJourneyEvidence(page);

    return {
      execution,
      proofRun: createProofRun(
        execution,
        evidence,
        durationMs,
        attemptedOutbound,
      ),
    };
  } finally {
    await context.close();
  }
}

function createJourneyPageAdapter(page: Page) {
  return createLunaPageAdapter({
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
      const evidence = await readJourneyEvidence(target);
      const alert = target.getByRole("alert");
      return {
        stage: await target.getByTestId("stage").textContent(),
        quote: await target.getByTestId("quote").textContent(),
        allowance: await target.getByTestId("allowance").textContent(),
        input_balance: await target.getByTestId("input-balance").textContent(),
        output_balance: await target.getByTestId("output-balance").textContent(),
        approval_submitted: evidence.approvalHash !== null,
        swap_submitted: evidence.swapHash !== null,
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
  });
}

async function readJourneyEvidence(page: Page): Promise<JourneyEvidence> {
  const account = await page.getByTestId("account").textContent();
  const approval = await page.getByTestId("approval-hash").textContent();
  const swap = await page.getByTestId("swap-hash").textContent();
  return {
    account: account === "not connected" ? null : account,
    approvalHash: approval?.match(/^Approval: (0x[0-9a-f]{64})$/)?.[1] ?? null,
    swapHash: swap?.match(/^Swap: (0x[0-9a-f]{64})$/)?.[1] ?? null,
  };
}

async function installBrowserNetworkGuard(
  context: BrowserContext,
  attemptedOutbound: string[],
): Promise<void> {
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (!["http:", "https:"].includes(url.protocol) || url.origin === PREVIEW_ORIGIN) {
      await route.continue();
      return;
    }
    attemptedOutbound.push(`http:${sanitizeNetworkTarget(url.href)}`);
    await route.abort("blockedbyclient");
  });
  await context.routeWebSocket(/.*/, async (socket) => {
    attemptedOutbound.push(`ws:${sanitizeNetworkTarget(socket.url())}`);
    await socket.close({ code: 1008, reason: "Outbound sockets are blocked" });
  });
}
