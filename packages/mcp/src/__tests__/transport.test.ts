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
});
