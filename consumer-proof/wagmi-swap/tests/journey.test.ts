import { afterEach, describe, expect, it } from "vitest";

import { disableLunaRuntimeIntercept } from "@lunatest/runtime-intercept";
import { createLunaVitestRunner } from "@lunatest/vitest-plugin";

import {
  createSwapJourney,
  observeJourneyState,
  observeJourneyUi,
} from "../src/journey";
import { createJourneyConfig } from "../src/wagmi";
import { reportSharedScenario, SWAP_SCENARIO_ID } from "./shared-scenario";

afterEach(() => disableLunaRuntimeIntercept());

describe("shared swap scenario", () => {
  it("executes the application journey through the Vitest runner", async () => {
    const journey = createSwapJourney(await createJourneyConfig());
    const execution = await createLunaVitestRunner({ cwd: process.cwd() }).assertScenario(
      SWAP_SCENARIO_ID,
      {
        async runWhen({ config }) {
          if (config.when?.action !== "complete_swap") {
            throw new Error(`Unsupported journey action: ${String(config.when?.action)}`);
          }
          await journey.connectWallet();
          await journey.requestQuote();
          await journey.approveToken();
          await journey.swapToken();
        },
        resolveUi: () => observeJourneyUi(journey.getSnapshot()),
        resolveState: () => observeJourneyState(journey.getSnapshot()),
        resolveTransitions: () => [...journey.getSnapshot().history],
      },
    );

    await reportSharedScenario("vitest", execution.scenario);
    expect(execution.execution.pass).toBe(true);
  });
});
