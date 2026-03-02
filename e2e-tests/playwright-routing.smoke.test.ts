import { describe, expect, it } from "vitest";

import { createLunaFixture } from "../packages/playwright-plugin/src/fixture";

type MockRoute = {
  request: () => {
    url: () => string;
    method: () => string;
    postDataJSON: () => unknown;
  };
  fulfill: (input: { status?: number; body?: string }) => Promise<void>;
  continue: () => Promise<void>;
  abort: () => Promise<void>;
  fulfilled?: { status?: number; body?: string };
  continued?: boolean;
  aborted?: boolean;
};

function createRoute(url: string, method: string, payload?: unknown): MockRoute {
  return {
    request() {
      return {
        url: () => url,
        method: () => method,
        postDataJSON: () => payload,
      };
    },
    async fulfill(input) {
      this.fulfilled = input;
    },
    async continue() {
      this.continued = true;
    },
    async abort() {
      this.aborted = true;
    },
  };
}

describe("e2e smoke: playwright routing", () => {
  it("handles rpc endpoint and blocks unknown in strict mode", async () => {
    const fixture = createLunaFixture({
      routing: {
        mode: "strict",
        rpcEndpoints: [
          {
            urlPattern: "https://rpc.test",
            methods: ["eth_chainId"],
            responseKey: "chain",
          },
        ],
      },
      mockResponses: {
        chain: { result: "0x1" },
      },
    });

    let handler: ((route: MockRoute) => Promise<void>) | null = null;
    await fixture.installRouting({
      async route(_pattern, h) {
        handler = h as (route: MockRoute) => Promise<void>;
      },
    });
    const installedHandler: (route: MockRoute) => Promise<void> =
      handler ??
      (async () => {
        throw new Error("routing handler was not installed");
      });

    const rpcRoute = createRoute("https://rpc.test", "POST", {
      id: 1,
      jsonrpc: "2.0",
      method: "eth_chainId",
      params: [],
    });

    await installedHandler(rpcRoute);
    const rpcBody = JSON.parse(rpcRoute.fulfilled?.body ?? "{}");
    expect(rpcBody.result).toBe("0x1");

    const unknownRoute = createRoute("https://unknown.test", "GET");
    await installedHandler(unknownRoute);
    expect(unknownRoute.aborted).toBe(true);
  });
});
