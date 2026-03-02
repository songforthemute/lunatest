import { describe, expect, it } from "vitest";

import { createMcpServer } from "../packages/mcp/src/server";

describe("e2e extended: scenario mutation flow", () => {
  it("creates and mutates scenario variants", async () => {
    const server = createMcpServer({
      scenarios: [{ id: "swap-1", name: "swap happy" }],
    });

    const result = await server.handleRequest({
      id: "mut-1",
      method: "scenario.mutate",
      params: {
        id: "swap-1",
        count: 2,
      },
    });

    expect(result).toEqual({
      id: "mut-1",
      result: [
        { id: "swap-1-mut-1", name: "swap happy mutation 1" },
        { id: "swap-1-mut-2", name: "swap happy mutation 2" },
      ],
    });
  });
});
