import { afterEach, describe, expect, it } from "vitest";

import {
  createLunaRuntimeIntercept,
  disableLunaRuntimeIntercept,
  enableLunaRuntimeIntercept,
  isLunaRuntimeInterceptEnabled,
  resolveEnabled,
} from "../runtime";

afterEach(() => {
  disableLunaRuntimeIntercept();
});

describe("runtime activation", () => {
  it("prefers config.enable over NODE_ENV", () => {
    expect(resolveEnabled({ enable: false }, "development")).toBe(false);
    expect(resolveEnabled({ enable: true }, "production")).toBe(true);
    expect(resolveEnabled({}, "development")).toBe(true);
    expect(resolveEnabled({}, "production")).toBe(false);
  });

  it("is idempotent while enabled", () => {
    const config = {
      enable: true,
      intercept: {
        mode: "strict" as const,
      },
    };

    expect(enableLunaRuntimeIntercept(config, "production")).toBe(true);
    expect(enableLunaRuntimeIntercept(config, "production")).toBe(true);
    expect(isLunaRuntimeInterceptEnabled()).toBe(true);

    disableLunaRuntimeIntercept();
    expect(isLunaRuntimeInterceptEnabled()).toBe(false);
  });

  it("stays disabled when guard blocks activation", () => {
    const runtime = createLunaRuntimeIntercept({
      intercept: {
        mode: "strict",
      },
    });

    expect(runtime.enable("production")).toBe(false);
    expect(runtime.isEnabled()).toBe(false);
  });
});
