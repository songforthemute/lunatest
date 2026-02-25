import { describe, expect, it } from "vitest";

import { createMcpServer } from "../server";

describe("mcp transport", () => {
  it("dispatches scenario.list request", async () => {
    const server = createMcpServer({
      scenarios: [
        {
          id: "swap-1",
          name: "swap happy path",
        },
      ],
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
        },
      ],
    });
  });

  it("dispatches coverage.gaps and resource/prompt calls", async () => {
    const server = createMcpServer({
      scenarios: [{ id: "swap-1", name: "swap happy path" }],
      coverage: {
        total: 3,
        covered: 1,
      },
      componentTree: [{ name: "SwapForm" }],
      componentStates: { SwapForm: ["idle", "pending", "success"] },
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
});
