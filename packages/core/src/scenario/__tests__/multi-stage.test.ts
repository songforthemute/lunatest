import { describe, expect, it } from "vitest";

import {
  createStageMachine,
  createVirtualClock,
  parseScenario,
} from "../index";

describe("scenario multi-stage", () => {
  it("executes 5-stage approve->swap flow deterministically", () => {
    const parsed = parseScenario({
      name: "approve-to-swap",
      given: {
        wallet: {
          connected: true,
        },
      },
      when: { action: "approve" },
      then_ui: { success: true },
      stages: [
        { name: "need_approval" },
        { name: "approve_pending" },
        { name: "ready_to_swap" },
        { name: "swap_pending" },
        { name: "complete" },
      ],
      then_state: { stage: "complete" },
    });

    const machine = createStageMachine(parsed.stages ?? []);
    const traversed: string[] = [machine.current().name];
    while (!machine.done()) {
      traversed.push(machine.next().name);
    }

    expect(traversed).toEqual([
      "need_approval",
      "approve_pending",
      "ready_to_swap",
      "swap_pending",
      "complete",
    ]);
  });

  it("advances virtual clock and drains due events", () => {
    const clock = createVirtualClock(0);
    clock.schedule(1000, { type: "tx_submitted" });
    clock.schedule(3000, { type: "tx_confirmed" });

    expect(clock.drainDue()).toEqual([]);

    clock.advance(1000);
    expect(clock.drainDue()).toEqual([{ type: "tx_submitted" }]);

    clock.advance(2000);
    expect(clock.drainDue()).toEqual([{ type: "tx_confirmed" }]);
  });
});
