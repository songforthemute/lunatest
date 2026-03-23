import { describe, expect, it } from "vitest";

import { buildCoverageSnapshot, resolveCoverageMetadata } from "../catalog";

describe("coverage catalog", () => {
  it("infers coverage metadata from scenario shape", () => {
    expect(
      resolveCoverageMetadata({
        when: { action: "swap" },
        then_ui: {
          quotePanel: { visible: true },
          warningPanel: { visible: true },
        },
        then_state: {
          approval: "required",
        },
        not_present: ["errorModal"],
      }),
    ).toEqual({
      features: ["swap"],
      states: ["approval", "errorModal", "quotePanel", "warningPanel"],
      components: ["quotePanel", "warningPanel"],
    });
  });

  it("prefers declared metadata while inferring missing fields", () => {
    expect(
      resolveCoverageMetadata({
        when: { action: "swap" },
        then_ui: {
          quotePanel: { visible: true },
        },
        coverage: {
          features: ["approve"],
        },
      }),
    ).toEqual({
      features: ["approve"],
      states: ["quotePanel"],
      components: ["quotePanel"],
    });
  });

  it("builds snapshot from catalog union", () => {
    expect(
      buildCoverageSnapshot({
        items: [
          {
            when: { action: "swap" },
            then_ui: {
              quotePanel: { visible: true },
            },
          },
          {
            coverage: {
              features: ["approve"],
              states: ["approvalPending"],
              components: ["actionButtonRow"],
            },
          },
        ],
        coverageCatalog: {
          features: ["swap", "approve", "bridge"],
          states: ["approvalPending", "confirmed"],
          components: ["quotePanel", "actionButtonRow", "txStepper"],
        },
      }),
    ).toEqual({
      total: 9,
      covered: 6,
      ratio: 0.6667,
      known: {
        features: ["approve", "bridge", "swap"],
        states: ["approvalPending", "confirmed", "quotePanel"],
        components: ["actionButtonRow", "quotePanel", "txStepper"],
      },
      coveredTargets: {
        features: ["approve", "swap"],
        states: ["approvalPending", "quotePanel"],
        components: ["actionButtonRow", "quotePanel"],
      },
      missing: {
        features: ["bridge"],
        states: ["confirmed"],
        components: ["txStepper"],
      },
    });
  });
});
