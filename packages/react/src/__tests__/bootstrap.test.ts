import { afterEach, describe, expect, it, vi } from "vitest";

import type { LuaConfig } from "@lunatest/core/browser";
import type { RouteMock } from "@lunatest/contracts";

import { bootstrapLunaRuntime } from "../bootstrap";

const mocks = vi.hoisted(() => ({
  loadLunaConfigMock: vi.fn<
    Parameters<(source: string | URL) => Promise<LuaConfig>>,
    ReturnType<(source: string | URL) => Promise<LuaConfig>>
  >(),
  createPresetRegistryMock: vi.fn(),
  materializeProtocolPresetMock: vi.fn(),
  materializeWalletPresetMock: vi.fn(),
  enableLunaRuntimeInterceptMock: vi.fn(),
  resolveEnabledMock: vi.fn(),
  setRouteMocksMock: vi.fn(),
  applyInterceptStateMock: vi.fn(),
  setWalletSessionMock: vi.fn(),
  mountLunaDevtoolsMock: vi.fn(),
  disableLunaRuntimeInterceptMock: vi.fn(),
}));

vi.mock("@lunatest/core/browser", () => ({
  loadLunaConfig: mocks.loadLunaConfigMock,
  createPresetRegistry: mocks.createPresetRegistryMock,
  materializeProtocolPreset: mocks.materializeProtocolPresetMock,
  materializeWalletPreset: mocks.materializeWalletPresetMock,
}));

vi.mock("@lunatest/runtime-intercept", () => ({
  enableLunaRuntimeIntercept: mocks.enableLunaRuntimeInterceptMock,
  disableLunaRuntimeIntercept: mocks.disableLunaRuntimeInterceptMock,
  resolveEnabled: mocks.resolveEnabledMock,
  setRouteMocks: mocks.setRouteMocksMock,
  applyInterceptState: mocks.applyInterceptStateMock,
  setWalletSession: mocks.setWalletSessionMock,
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
    mocks.resolveEnabledMock.mockReturnValueOnce(false);

    const result = await bootstrapLunaRuntime({
      nodeEnv: "production",
    });

    expect(mocks.loadLunaConfigMock).not.toHaveBeenCalled();
    expect(mocks.createPresetRegistryMock).not.toHaveBeenCalled();
    expect(mocks.enableLunaRuntimeInterceptMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      enabled: false,
      configLoaded: false,
    });
    expect(mocks.setRouteMocksMock).not.toHaveBeenCalled();
    expect(mocks.applyInterceptStateMock).not.toHaveBeenCalled();
    expect(mocks.setWalletSessionMock).not.toHaveBeenCalled();
    expect(mocks.mountLunaDevtoolsMock).not.toHaveBeenCalled();
  });

  it("loads config in production when enable is explicitly true", async () => {
    const config = createConfig();
    mocks.loadLunaConfigMock.mockResolvedValueOnce(config);
    mocks.createPresetRegistryMock.mockReturnValueOnce({ tag: "registry" });
    mocks.enableLunaRuntimeInterceptMock.mockReturnValueOnce(true);

    const result = await bootstrapLunaRuntime({
      nodeEnv: "production",
      enable: true,
      mountDevtools: false,
    });

    expect(mocks.loadLunaConfigMock).toHaveBeenCalledWith("./lunatest.lua");
    expect(mocks.enableLunaRuntimeInterceptMock).toHaveBeenCalledWith(
      {
        enable: true,
        intercept: {
          mode: "strict",
          mockResponses: {},
        },
      },
      "production",
    );
    expect(result).toEqual({
      enabled: true,
      configLoaded: true,
      config,
      unmountDevtools: undefined,
    });
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
    mocks.createPresetRegistryMock.mockReturnValueOnce({ tag: "registry" });
    mocks.resolveEnabledMock.mockReturnValueOnce(true);
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
      panelProps: {
        presetRegistry: { tag: "registry" },
        walletFallbackMode: "off",
      },
    });
    expect(result.enabled).toBe(true);
    expect(result.configLoaded).toBe(true);
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
    mocks.createPresetRegistryMock.mockReturnValueOnce({ tag: "registry" });
    mocks.resolveEnabledMock.mockReturnValueOnce(true);
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
    expect(result.configLoaded).toBe(true);
  });

  it("applies registry-backed protocol and wallet presets before devtools mount", async () => {
    const config = createConfig();

    mocks.loadLunaConfigMock.mockResolvedValueOnce(config);
    mocks.createPresetRegistryMock.mockReturnValueOnce({ tag: "registry" });
    mocks.resolveEnabledMock.mockReturnValueOnce(true);
    mocks.enableLunaRuntimeInterceptMock.mockReturnValueOnce(true);
    mocks.materializeProtocolPresetMock.mockResolvedValueOnce({
      protocolPresetId: "uniswap_v3",
      walletPresetId: "demo_sepolia",
      resolvedParams: {},
      walletSession: { enabled: false, connected: false, chainId: "0xaa36a7", accounts: [], permissions: [], assets: { nativeBalance: "0", tokens: {} } },
      interceptState: { chain: { id: 11155111 } },
      routeMocks: [],
      builtinScenarios: [],
    });
    mocks.materializeWalletPresetMock.mockResolvedValueOnce({
      walletPresetId: "empty_wallet",
      resolvedParams: {},
      walletSession: { enabled: false, connected: false, chainId: "0x1", accounts: [], permissions: [], assets: { nativeBalance: "0", tokens: {} } },
    });

    await bootstrapLunaRuntime({
      nodeEnv: "development",
      protocolPresetId: "uniswap_v3",
      walletPresetId: "empty_wallet",
    });

    expect(mocks.materializeProtocolPresetMock).toHaveBeenCalledWith(
      "uniswap_v3",
      undefined,
      { tag: "registry" },
    );
    expect(mocks.materializeWalletPresetMock).toHaveBeenCalledWith(
      "empty_wallet",
      undefined,
      { tag: "registry" },
    );
    expect(mocks.setWalletSessionMock).toHaveBeenCalledTimes(2);
  });

  it("initializes wallet preset and passes fallback mode to devtools", async () => {
    const config = createConfig();

    mocks.loadLunaConfigMock.mockResolvedValueOnce(config);
    mocks.createPresetRegistryMock.mockReturnValueOnce({ tag: "registry" });
    mocks.resolveEnabledMock.mockReturnValueOnce(true);
    mocks.enableLunaRuntimeInterceptMock.mockReturnValueOnce(true);
    mocks.mountLunaDevtoolsMock.mockReturnValueOnce(() => undefined);

    await bootstrapLunaRuntime({
      nodeEnv: "development",
      walletFallbackMode: "manual-toggle",
      walletPreset: {
        address: "0x1111111111111111111111111111111111111111",
        chainId: "0xaa36a7",
      },
    });

    expect(mocks.setWalletSessionMock).toHaveBeenCalledWith({
      enabled: false,
      connected: false,
      chainId: "0xaa36a7",
      accounts: ["0x1111111111111111111111111111111111111111"],
      permissions: [],
      assets: {
        nativeBalance: "0",
        tokens: {},
      },
    });

    expect(mocks.mountLunaDevtoolsMock).toHaveBeenCalledWith({
      targetId: undefined,
      nodeEnv: "development",
      panelProps: {
        presetRegistry: { tag: "registry" },
        walletFallbackMode: "manual-toggle",
      },
    });
  });

  it("builds registry from injected project preset sources", async () => {
    const config = createConfig();

    mocks.loadLunaConfigMock.mockResolvedValueOnce(config);
    mocks.createPresetRegistryMock.mockReturnValueOnce({ tag: "project-registry" });
    mocks.resolveEnabledMock.mockReturnValueOnce(true);
    mocks.enableLunaRuntimeInterceptMock.mockReturnValueOnce(true);

    await bootstrapLunaRuntime({
      nodeEnv: "development",
      projectPresetSources: {
        protocol: {
          "team/swap": "return { manifest = { id = 'team/swap' }, materialize = function() return {} end }",
        },
      },
    });

    expect(mocks.createPresetRegistryMock).toHaveBeenCalledWith({
      projectSources: {
        protocol: {
          "team/swap": "return { manifest = { id = 'team/swap' }, materialize = function() return {} end }",
        },
      },
    });
  });

  it("disables intercept when bootstrap fails after enable", async () => {
    const config = createConfig();

    mocks.loadLunaConfigMock.mockResolvedValueOnce(config);
    mocks.createPresetRegistryMock.mockReturnValueOnce({ tag: "registry" });
    mocks.resolveEnabledMock.mockReturnValueOnce(true);
    mocks.enableLunaRuntimeInterceptMock.mockReturnValueOnce(true);
    mocks.materializeProtocolPresetMock.mockRejectedValueOnce(new Error("preset failed"));

    await expect(
      bootstrapLunaRuntime({
        nodeEnv: "development",
        protocolPresetId: "bad-preset",
      }),
    ).rejects.toThrow("preset failed");

    expect(mocks.disableLunaRuntimeInterceptMock).toHaveBeenCalledTimes(1);
  });
});
