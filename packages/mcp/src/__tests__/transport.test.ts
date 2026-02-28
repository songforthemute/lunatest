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
        },
      ],
      coverage: {
        total: 3,
        covered: 1,
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
        { id: "gap-1", reason: "scenario not covered" },
        { id: "gap-2", reason: "scenario not covered" },
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
});
