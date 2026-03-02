import { afterEach, describe, expect, it } from "vitest";

import { disableLunaRuntimeIntercept } from "@lunatest/runtime-intercept";

import { enableLunaIntercept } from "../intercept";

afterEach(() => {
  disableLunaRuntimeIntercept();
});

describe("enableLunaIntercept", () => {
  it("honors NODE_ENV guard", () => {
    expect(
      enableLunaIntercept({
        config: {},
        nodeEnv: "production",
      }),
    ).toBe(false);

    expect(
      enableLunaIntercept({
        config: {},
        nodeEnv: "development",
      }),
    ).toBe(true);
  });

  it("prefers explicit enable flag when provided", () => {
    expect(
      enableLunaIntercept({
        config: {
          enable: true,
          intercept: {
            mode: "strict",
          },
        },
        nodeEnv: "production",
      }),
    ).toBe(true);
  });
});
