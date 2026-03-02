import { describe, expect, it } from "vitest";

import type { LunaRuntimeInterceptConfig, RouteMock } from "../types";

describe("runtime-intercept types", () => {
  it("accepts minimal config", () => {
    const config: LunaRuntimeInterceptConfig = { intercept: {} };
    expect(config).toBeTruthy();
  });

  it("accepts route mock union", () => {
    const route: RouteMock = {
      endpointType: "http",
      urlPattern: "https://api.example/quote",
      method: "GET",
      responseKey: "quote",
    };

    expect(route.endpointType).toBe("http");
  });
});
