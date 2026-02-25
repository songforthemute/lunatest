import { describe, expect, it } from "vitest";

import { createLunaCommands } from "../commands";
import { createLunaFixture } from "../fixture";

type MockRequest = {
  url: string;
  method: string;
  postData?: unknown;
};

type MockRoute = {
  request: () => {
    url: () => string;
    method: () => string;
    postDataJSON: () => unknown;
  };
  fulfill: (input: {
    status?: number;
    contentType?: string;
    body?: string;
  }) => Promise<void>;
  continue: () => Promise<void>;
  abort: () => Promise<void>;
  fulfilled?: {
    status?: number;
    contentType?: string;
    body?: string;
  };
  continued?: boolean;
  aborted?: boolean;
};

function createMockRoute(input: MockRequest): MockRoute {
  return {
    request() {
      return {
        url: () => input.url,
        method: () => input.method,
        postDataJSON: () => input.postData,
      };
    },
    async fulfill(payload) {
      this.fulfilled = payload;
    },
    async continue() {
      this.continued = true;
    },
    async abort() {
      this.aborted = true;
    },
  };
}

describe("playwright plugin", () => {
  it("creates fixture", async () => {
    const fixture = createLunaFixture();
    await expect(fixture.injectProvider()).resolves.toBeUndefined();
  });

  it("creates commands", async () => {
    const commands = createLunaCommands();
    await expect(commands.runScenario("swap-1")).resolves.toEqual({
      id: "swap-1",
      pass: true,
    });
  });

  it("injects provider script into init target", async () => {
    const scripts: string[] = [];
    const fixture = createLunaFixture();

    await fixture.injectProvider({
      addInitScript(script: string) {
        scripts.push(script);
      },
    });

    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toContain("window.ethereum");
  });

  it("fulfills configured rpc endpoint from routing array", async () => {
    let handler: ((route: MockRoute) => Promise<void>) | null = null;
    const fixture = createLunaFixture({
      routing: {
        mode: "strict",
        rpcEndpoints: [
          {
            urlPattern: "https://rpc.example",
            methods: ["eth_chainId"],
            responseKey: "chain-id",
          },
        ],
      },
      mockResponses: {
        "chain-id": {
          result: "0x1",
        },
      },
    });

    await fixture.installRouting({
      async route(_pattern, nextHandler) {
        handler = nextHandler;
      },
    });

    expect(handler).toBeTypeOf("function");

    const route = createMockRoute({
      url: "https://rpc.example",
      method: "POST",
      postData: {
        id: 7,
        jsonrpc: "2.0",
        method: "eth_chainId",
        params: [],
      },
    });

    await handler?.(route);
    expect(route.fulfilled).toBeDefined();
    expect(route.fulfilled?.contentType).toBe("application/json");

    const body = JSON.parse(route.fulfilled?.body ?? "{}");
    expect(body).toEqual({
      id: 7,
      jsonrpc: "2.0",
      result: "0x1",
    });
  });

  it("fulfills configured http endpoint from routing array", async () => {
    let handler: ((route: MockRoute) => Promise<void>) | null = null;
    const fixture = createLunaFixture({
      routing: {
        mode: "strict",
        httpEndpoints: [
          {
            urlPattern: "https://api.example/prices",
            method: "GET",
            responseKey: "prices",
          },
        ],
      },
      mockResponses: {
        prices: {
          status: 200,
          body: {
            ETH: "3100",
            USDC: "1",
          },
        },
      },
    });

    await fixture.installRouting({
      async route(_pattern, nextHandler) {
        handler = nextHandler;
      },
    });

    const route = createMockRoute({
      url: "https://api.example/prices",
      method: "GET",
    });

    await handler?.(route);
    expect(route.fulfilled).toBeDefined();
    expect(route.fulfilled?.status).toBe(200);
    expect(JSON.parse(route.fulfilled?.body ?? "{}")).toEqual({
      ETH: "3100",
      USDC: "1",
    });
  });

  it("blocks unmatched requests in strict mode", async () => {
    let handler: ((route: MockRoute) => Promise<void>) | null = null;
    const fixture = createLunaFixture({
      routing: {
        mode: "strict",
      },
    });

    await fixture.installRouting({
      async route(_pattern, nextHandler) {
        handler = nextHandler;
      },
    });

    const route = createMockRoute({
      url: "https://unknown.example",
      method: "GET",
    });

    await handler?.(route);
    expect(route.aborted).toBe(true);
    expect(route.continued).not.toBe(true);
  });

  it("passes through unmatched requests in permissive mode", async () => {
    let handler: ((route: MockRoute) => Promise<void>) | null = null;
    const fixture = createLunaFixture({
      routing: {
        mode: "permissive",
      },
    });

    await fixture.installRouting({
      async route(_pattern, nextHandler) {
        handler = nextHandler;
      },
    });

    const route = createMockRoute({
      url: "https://unknown.example",
      method: "GET",
    });

    await handler?.(route);
    expect(route.continued).toBe(true);
    expect(route.aborted).not.toBe(true);
  });
});
