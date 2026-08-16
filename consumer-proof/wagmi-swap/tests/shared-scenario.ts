import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { LunaProjectScenario } from "@lunatest/core";

export const SWAP_SCENARIO_ID = "scenarios/approve-and-swap";

export async function reportSharedScenario(
  runner: "playwright" | "vitest",
  scenario: LunaProjectScenario,
): Promise<void> {
  const expectedSource = await readFile(resolve(`${SWAP_SCENARIO_ID}.lua`), "utf8");
  const expectedDigest = `sha256:${createHash("sha256")
    .update(expectedSource, "utf8")
    .digest("hex")}`;

  if (scenario.id !== SWAP_SCENARIO_ID) {
    throw new Error(`Unexpected scenario ID: ${scenario.id}`);
  }
  if (scenario.lua !== expectedSource || scenario.sourceDigest !== expectedDigest) {
    throw new Error(
      `Scenario source mismatch: expected ${expectedDigest}, got ${scenario.sourceDigest}`,
    );
  }

  console.info(
    `[shared-scenario] runner=${runner} id=${scenario.id} digest=${scenario.sourceDigest}`,
  );
}
