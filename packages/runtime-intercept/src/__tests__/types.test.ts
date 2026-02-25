import { describe, expect, it } from "vitest";

import type { LunaRuntimeInterceptConfig } from "../types";

describe("runtime-intercept types", () => {
  it("accepts minimal config", () => {
    const config: LunaRuntimeInterceptConfig = { intercept: {} };
    expect(config).toBeTruthy();
  });
});
