import { describe, expect, it } from "vitest";

import { createMcpServer } from "../packages/mcp/src/server";

describe("mcp flow", () => {
  it("runs create -> run -> gaps flow", async () => {
    const server = createMcpServer({
      scenarios: [],
      coverage: { total: 2, covered: 1 },
      scenarioAdapter: {
        resolveUi: async () => ({}),
      },
    });

    const created = await server.handleRequest({
      id: "1",
      method: "scenario.create",
      params: {
        id: "swap-1",
        name: "swap happy path",
        lua: "scenario { name = 'swap', given = {}, when = { action = 'swap' }, then_ui = {} }",
      },
    });

    expect(created).toEqual({
      id: "1",
      result: {
        id: "swap-1",
        name: "swap happy path",
        lua: "scenario { name = 'swap', given = {}, when = { action = 'swap' }, then_ui = {} }",
      },
    });

    const run = await server.handleRequest({
      id: "2",
      method: "scenario.run",
      params: {
        id: "swap-1",
      },
    });

    expect(run).toEqual({
      id: "2",
      result: {
        id: "swap-1",
        pass: true,
        diff: "",
        error: undefined,
      },
    });

    const gaps = await server.handleRequest({
      id: "3",
      method: "coverage.gaps",
      params: {},
    });

    expect(gaps).toEqual({
      id: "3",
      result: [{ id: "gap-1", reason: "scenario not covered" }],
    });
  });
});
