import { afterEach, describe, expect, it, vi } from "vitest";

import type { LuaConfig } from "@lunatest/core";
import type { RouteMock } from "@lunatest/contracts";

import { bootstrapLunaRuntime } from "../bootstrap";

const mocks = vi.hoisted(() => ({
  loadLunaConfigMock: vi.fn<
    Parameters<(source: string | URL) => Promise<LuaConfig>>,
    ReturnType<(source: string | URL) => Promise<LuaConfig>>
  >(),
  enableLunaRuntimeInterceptMock: vi.fn(),
  setRouteMocksMock: vi.fn(),
  applyInterceptStateMock: vi.fn(),
  mountLunaDevtoolsMock: vi.fn(),
}));

vi.mock("@lunatest/core", () => ({
  loadLunaConfig: mocks.loadLunaConfigMock,
}));

vi.mock("@lunatest/runtime-intercept", () => ({
  enableLunaRuntimeIntercept: mocks.enableLunaRuntimeInterceptMock,
  setRouteMocks: mocks.setRouteMocksMock,
  applyInterceptState: mocks.applyInterceptStateMock,
}));

vi.mock("../devtools/mount", () => ({
  mountLunaDevtools: mocks.mountLunaDevtoolsMock,
}));

function createConfig(overrides: Partial<LuaConfig> = {}): LuaConfig {
  return {
    mode: "strict",
    given: {},
    ...overrides,
  } as LuaConfig;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("bootstrapLunaRuntime", () => {
  it("returns disabled result when runtime intercept is not enabled", async () => {
    const config = createConfig();
    mocks.loadLunaConfigMock.mockResolvedValueOnce(config);
    mocks.enableLunaRuntimeInterceptMock.mockReturnValueOnce(false);

    const result = await bootstrapLunaRuntime();

    expect(mocks.loadLunaConfigMock).toHaveBeenCalledWith("./lunatest.lua");
    expect(result).toEqual({
      enabled: false,
      config,
    });
    expect(mocks.setRouteMocksMock).not.toHaveBeenCalled();
    expect(mocks.applyInterceptStateMock).not.toHaveBeenCalled();
    expect(mocks.mountLunaDevtoolsMock).not.toHaveBeenCalled();
  });

  it("loads config and applies routes/state in enabled development mode", async () => {
    const routes: RouteMock[] = [
      {
        endpointType: "ethereum",
        method: "eth_chainId",
        responseKey: "wallet.chainId",
      },
    ];

    const config = createConfig({
      given: { wallet: { connected: true } },
      intercept: {
        routes,
        mockResponses: {
          "wallet.chainId": { result: "0x1" },
        },
        state: {
          chain: { id: 1 },
        },
      },
    });

    mocks.loadLunaConfigMock.mockResolvedValueOnce(config);
    mocks.enableLunaRuntimeInterceptMock.mockReturnValueOnce(true);
    mocks.mountLunaDevtoolsMock.mockReturnValueOnce(() => undefined);

    const result = await bootstrapLunaRuntime({
      nodeEnv: "development",
    });

    expect(mocks.enableLunaRuntimeInterceptMock).toHaveBeenCalledWith(
      {
        intercept: {
          mode: "strict",
          mockResponses: config.intercept?.mockResponses,
        },
      },
      "development",
    );
    expect(mocks.setRouteMocksMock).toHaveBeenCalledWith(routes);
    expect(mocks.applyInterceptStateMock).toHaveBeenNthCalledWith(1, config.given);
    expect(mocks.applyInterceptStateMock).toHaveBeenNthCalledWith(
      2,
      config.intercept?.state,
    );
    expect(mocks.mountLunaDevtoolsMock).toHaveBeenCalledWith({
      targetId: undefined,
      nodeEnv: "development",
    });
    expect(result.enabled).toBe(true);
    expect(typeof result.unmountDevtools).toBe("function");
  });

  it("prefers override routes and supports mount skip option", async () => {
    const config = createConfig({
      intercept: {
        routes: [
          {
            endpointType: "ethereum",
            method: "eth_accounts",
            responseKey: "wallet.accounts",
          },
        ],
      },
    });

    const overrideRoutes: RouteMock[] = [
      {
        endpointType: "http",
        urlPattern: "**/api/quote",
        method: "GET",
        responseKey: "api.quote",
      },
    ];

    mocks.loadLunaConfigMock.mockResolvedValueOnce(config);
    mocks.enableLunaRuntimeInterceptMock.mockReturnValueOnce(true);

    const result = await bootstrapLunaRuntime({
      nodeEnv: "development",
      mountDevtools: false,
      configOverride: {
        intercept: {
          routes: overrideRoutes,
        },
      },
    });

    expect(mocks.setRouteMocksMock).toHaveBeenCalledWith(overrideRoutes);
    expect(mocks.mountLunaDevtoolsMock).not.toHaveBeenCalled();
    expect(result.unmountDevtools).toBeUndefined();
  });
});
