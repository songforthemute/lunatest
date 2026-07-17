import { describe, expect, it } from "vitest";

import { createMcpServer } from "../server";

describe("mcp transport", () => {
  it("dispatches scenario.list request", async () => {
    const server = createMcpServer({
      scenarios: [
        {
          id: "swap-1",
          name: "swap happy path",
          lua: "scenario { name = 'swap', given = {}, when = { action = 'swap' }, then_ui = {} }",
        },
      ],
      scenarioAdapter: {
        resolveUi: async () => ({}),
      },
    });

    const response = await server.handleRequest({
      id: "req-1",
      method: "scenario.list",
      params: {},
    });

    expect(response).toEqual({
      id: "req-1",
      result: [
        {
          id: "swap-1",
          name: "swap happy path",
          lua: "scenario { name = 'swap', given = {}, when = { action = 'swap' }, then_ui = {} }",
        },
      ],
    });
  });

  it("dispatches coverage.gaps and resource/prompt calls", async () => {
    const server = createMcpServer({
      scenarios: [
        {
          id: "swap-1",
          name: "swap happy path",
          lua: "scenario { name = 'swap', given = {}, when = { action = 'swap' }, then_ui = {} }",
          coverage: {
            features: ["swap"],
            states: ["quoteLoaded"],
            components: ["SwapForm"],
          },
        },
      ],
      coverageCatalog: {
        features: ["swap", "approve"],
        states: ["quoteLoaded", "approvalPending"],
        components: ["SwapForm", "ActionButtonRow"],
      },
      componentTree: [{ name: "SwapForm" }],
      componentStates: { SwapForm: ["idle", "pending", "success"] },
      scenarioAdapter: {
        resolveUi: async () => ({}),
      },
    });

    const gaps = await server.handleRequest({
      id: "req-gap",
      method: "coverage.gaps",
      params: {},
    });
    expect(gaps).toEqual({
      id: "req-gap",
      result: [
        { kind: "feature", id: "approve", reason: "scenario not covered" },
        { kind: "state", id: "approvalPending", reason: "scenario not covered" },
        { kind: "component", id: "ActionButtonRow", reason: "scenario not covered" },
      ],
    });

    const resourceList = await server.handleRequest({
      id: "req-resource-list",
      method: "resource.list",
      params: {},
    });
    expect(resourceList).toEqual({
      id: "req-resource-list",
      result: expect.arrayContaining([
        "lunatest://scenarios",
        "lunatest://coverage",
        "lunatest://components",
      ]),
    });

    const protocolResource = await server.handleRequest({
      id: "req-protocol-resource",
      method: "resource.get",
      params: {
        uri: "lunatest://protocols",
      },
    });
    expect(protocolResource).toEqual({
      id: "req-protocol-resource",
      result: expect.objectContaining({
        uri: "lunatest://protocols",
        content: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            label: expect.any(String),
            source: expect.any(String),
            kind: expect.any(String),
          }),
        ]),
      }),
    });

    const componentStates = await server.handleRequest({
      id: "req-component-states",
      method: "component.states",
      params: {
        name: "SwapForm",
      },
    });
    expect(componentStates).toEqual({
      id: "req-component-states",
      result: {
        componentCoverage: {
          known: true,
          covered: true,
          missing: false,
        },
        states: ["idle", "pending", "success"],
      },
    });

    const prompt = await server.handleRequest({
      id: "req-prompt",
      method: "prompt.get",
      params: {
        id: "generate-edge-cases",
        input: "SwapForm",
      },
    });
    expect(prompt).toEqual({
      id: "req-prompt",
      result: {
        id: "generate-edge-cases",
        text: expect.stringContaining("SwapForm"),
      },
    });
  });

  it("supports inline scenario run and route/state mock tools", async () => {
    const server = createMcpServer({
      scenarios: [
        {
          id: "swap-1",
          name: "swap happy path",
          lua: "scenario { name = 'swap', given = {}, when = { action = 'swap' }, then_ui = {} }",
        },
      ],
      scenarioAdapter: {
        resolveUi: async () => ({}),
      },
    });

    const inlineRun = await server.handleRequest({
      id: "req-inline",
      method: "scenario.run",
      params: {
        lua: "scenario { name = 'inline', given = {} }",
      },
    });

    expect(inlineRun).toEqual({
      id: "req-inline",
      result: {
        id: "inline",
        pass: true,
        diff: "",
        error: undefined,
      },
    });

    const routeSet = await server.handleRequest({
      id: "req-routes",
      method: "mock.routes.set",
      params: {
        routes: [
          {
            endpointType: "http",
            urlPattern: "https://api.example/quote",
            method: "GET",
            responseKey: "quote",
          },
        ],
      },
    });

    expect(routeSet).toEqual({
      id: "req-routes",
      result: [
        {
          endpointType: "http",
          urlPattern: "https://api.example/quote",
          method: "GET",
          responseKey: "quote",
        },
      ],
    });

    const statePatched = await server.handleRequest({
      id: "req-state-patch",
      method: "state.patch",
      params: {
        state: {
          wallet: { connected: true },
        },
      },
    });

    expect(statePatched).toEqual({
      id: "req-state-patch",
      result: {
        wallet: { connected: true },
      },
    });
  });

  it("exposes protocol and wallet preset tools from registry", async () => {
    const server = createMcpServer({});

    const protocolList = await server.handleRequest({
      id: "req-protocol-list",
      method: "mock.listProtocolPresets",
      params: {},
    });

    expect(protocolList).toEqual({
      id: "req-protocol-list",
      result: expect.arrayContaining([
        expect.objectContaining({ id: "uniswap_v3" }),
        expect.objectContaining({ id: "curve" }),
      ]),
    });

    const protocolApply = await server.handleRequest({
      id: "req-protocol-apply",
      method: "mock.applyProtocolPreset",
      params: {
        id: "uniswap_v3",
        params: {
          chainId: 11155111,
          quoter: "v1",
        },
      },
    });

    expect(protocolApply).toEqual({
      id: "req-protocol-apply",
      result: expect.objectContaining({
        protocolPresetId: "builtin/uniswap_v3",
        walletPresetId: "builtin/demo_sepolia",
        interceptState: expect.objectContaining({
          protocol: expect.objectContaining({
            components: expect.objectContaining({
              quoter: "v1",
            }),
          }),
        }),
      }),
    });

    const walletApply = await server.handleRequest({
      id: "req-wallet-apply",
      method: "mock.applyWalletPreset",
      params: {
        id: "demo_sepolia",
        params: {
          address: "0x1111111111111111111111111111111111111111",
          chainId: 11155111,
        },
      },
    });

    expect(walletApply).toEqual({
      id: "req-wallet-apply",
      result: expect.objectContaining({
        walletPresetId: "builtin/demo_sepolia",
        walletSession: expect.objectContaining({
          chainId: "0xaa36a7",
        }),
      }),
    });
  });

  it("exposes structured preset diagnostics for malformed local presets", async () => {
    const server = createMcpServer({
      projectPresetSources: {
        protocol: {
          bad_swap: `return {
            manifest = {
              id = "bad_swap",
              label = "Bad Swap",
              kind = "dex",
              supportedChains = { 11155111 },
              protocol = "teamdex",
              version = "v1",
              components = { quoter = "local" },
              defaultWalletPreset = { id = "missing_wallet" },
              defaultInterceptState = {},
              defaultRouteMocks = {},
              builtinScenarios = {},
              paramsSchema = {},
              recommendedControls = { "tokenIn" },
            },
            materialize = function()
              return {}
            end,
          }`,
        },
      },
    });

    const diagnostics = await server.handleRequest({
      id: "req-diagnostics",
      method: "mock.listPresetDiagnostics",
      params: {},
    });

    expect(diagnostics).toEqual({
      id: "req-diagnostics",
      result: expect.arrayContaining([
        expect.objectContaining({
          code: "preset_wallet_reference_missing",
          qualifiedId: "project/bad_swap",
          source: "project",
        }),
      ]),
    });
  });
});
