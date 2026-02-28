import { afterEach, describe, expect, it } from "vitest";

import {
  appendRouteMocks,
  applyInterceptState,
  createLunaRuntimeIntercept,
  disableLunaRuntimeIntercept,
  enableLunaRuntimeIntercept,
  getInterceptState,
  isLunaRuntimeInterceptEnabled,
  resolveEnabled,
  setRouteMocks,
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

  it("updates route mocks and runtime state while enabled", () => {
    expect(
      enableLunaRuntimeIntercept(
        {
          enable: true,
          intercept: {
            mode: "strict",
          },
        },
        "production",
      ),
    ).toBe(true);

    const routes = setRouteMocks([
      {
        endpointType: "ethereum",
        method: "eth_chainId",
        responseKey: "chain-id",
      },
      {
        endpointType: "http",
        urlPattern: "https://api.example/quote",
        method: "GET",
        responseKey: "quote",
      },
    ]);

    expect(routes).toHaveLength(2);

    const appended = appendRouteMocks([
      {
        endpointType: "rpc",
        urlPattern: "https://rpc.example",
        methods: ["eth_call"],
        responseKey: "rpc-call",
      },
    ]);

    expect(appended).toHaveLength(3);

    const state = applyInterceptState({
      mode: "permissive",
      mockResponses: {
        "chain-id": {
          result: "0x1",
        },
      },
    });

    expect(state.mode).toBe("permissive");
    expect(getInterceptState().mockResponses).toEqual({
      "chain-id": {
        result: "0x1",
      },
    });
  });

  it("keeps existing routes on partial routing patch", () => {
    expect(
      enableLunaRuntimeIntercept(
        {
          enable: true,
          intercept: {
            mode: "strict",
          },
        },
        "production",
      ),
    ).toBe(true);

    setRouteMocks([
      {
        endpointType: "ethereum",
        method: "eth_chainId",
        responseKey: "chain-id",
      },
    ]);

    applyInterceptState({
      routing: {
        httpEndpoints: [
          {
            urlPattern: "https://api.example/quote",
            method: "GET",
            responseKey: "quote",
          },
        ],
      },
    });

    const currentRoutes = appendRouteMocks([]);
    expect(currentRoutes).toEqual([
      {
        endpointType: "ethereum",
        method: "eth_chainId",
        responseKey: "chain-id",
      },
      {
        endpointType: "http",
        urlPattern: "https://api.example/quote",
        method: "GET",
        responseKey: "quote",
      },
    ]);
  });

  it("exposes mutable APIs from direct handle", () => {
    const runtime = createLunaRuntimeIntercept({
      enable: true,
      intercept: {
        mode: "strict",
      },
    });

    const routes = runtime.setRouteMocks?.([
      {
        endpointType: "rpc",
        urlPattern: "https://rpc.example",
        methods: ["eth_call"],
        responseKey: "rpc-call",
      },
    ]);

    expect(routes).toEqual([
      {
        endpointType: "rpc",
        urlPattern: "https://rpc.example",
        methods: ["eth_call"],
        responseKey: "rpc-call",
      },
    ]);

    const state = runtime.applyInterceptState?.({
      chain: {
        gasPrice: 30,
      },
    });

    expect(state).toEqual({
      chain: {
        gasPrice: 30,
      },
    });
  });

  it("normalizes route array from config input", () => {
    const runtime = createLunaRuntimeIntercept({
      enable: true,
      intercept: {
        mode: "strict",
        routes: [
          {
            endpointType: "ethereum",
            method: "eth_chainId",
            responseKey: "chain-id",
          },
        ],
        mockResponses: {
          "chain-id": {
            result: "0x1",
          },
        },
      },
    });

    expect(runtime.enable("production")).toBe(true);
    runtime.disable();
    expect(runtime.isEnabled()).toBe(false);
  });
});
