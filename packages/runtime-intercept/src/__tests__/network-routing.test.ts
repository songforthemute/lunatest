import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createInterceptedFetch } from "../interceptors/fetch";
import { installXhrInterceptor } from "../interceptors/xhr";
import { createLogger } from "../logger";
import { normalizeRuntimeInterceptConfig } from "../runtime";

function waitForMicrotask(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

class FakeXMLHttpRequest {
  static instances: FakeXMLHttpRequest[] = [];

  readyState = 0;
  status = 0;
  statusText = "";
  responseText = "";
  response: unknown = null;
  responseType: XMLHttpRequestResponseType = "";

  onreadystatechange: ((event: Event) => void) | null = null;
  onload: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onabort: ((event: Event) => void) | null = null;

  method = "GET";
  url = "";
  isSent = false;

  constructor() {
    FakeXMLHttpRequest.instances.push(this);
  }

  open(method: string, url: string): void {
    this.method = method;
    this.url = url;
    this.readyState = 1;
    this.onreadystatechange?.(new Event("readystatechange"));
  }

  setRequestHeader(): void {
    return;
  }

  send(body?: unknown): void {
    this.isSent = true;
    this.readyState = 4;
    this.status = 200;
    this.statusText = "OK";
    this.responseText = JSON.stringify({ passthrough: true, body });
    this.response = this.responseText;

    this.onreadystatechange?.(new Event("readystatechange"));
    this.onload?.(new Event("load"));
  }

  abort(): void {
    this.onabort?.(new Event("abort"));
  }

  getAllResponseHeaders(): string {
    return "content-type: application/json";
  }
}

describe("network routing", () => {
  const originalXmlHttpRequest = (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest;

  beforeEach(() => {
    FakeXMLHttpRequest.instances = [];
    (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest =
      FakeXMLHttpRequest as unknown as XMLHttpRequest;
  });

  afterEach(() => {
    (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = originalXmlHttpRequest;
  });

  it("fulfills RPC request via fetch route", async () => {
    const fetch = createInterceptedFetch({
      getSnapshot: () => ({
        mode: "strict",
        routing: {
          rpcEndpoints: [
            {
              urlPattern: "https://rpc.example",
              methods: ["eth_chainId"],
              responseKey: "chain-id",
            },
          ],
        },
        mockResponses: {
          "chain-id": { result: "0x1" },
        },
      }),
      logger: createLogger(false),
    });

    const response = await fetch("https://rpc.example", {
      method: "POST",
      body: JSON.stringify({
        id: 7,
        jsonrpc: "2.0",
        method: "eth_chainId",
        params: [],
      }),
    });

    await expect(response.json()).resolves.toEqual({
      id: 7,
      jsonrpc: "2.0",
      result: "0x1",
    });
  });

  it("blocks unmatched fetch request in strict mode", async () => {
    const fetch = createInterceptedFetch({
      getSnapshot: () => ({
        mode: "strict",
        routing: {
          rpcEndpoints: [],
          httpEndpoints: [],
        },
        mockResponses: {},
      }),
      logger: createLogger(false),
    });

    await expect(fetch("https://unknown.example")).rejects.toThrow("blocked unmatched request");
  });

  it("forwards unmatched fetch request in permissive mode", async () => {
    const baseFetch = vi.fn(async () => new Response("ok", { status: 200 }));
    const fetch = createInterceptedFetch({
      getSnapshot: () => ({
        mode: "permissive",
        routing: {
          rpcEndpoints: [],
          httpEndpoints: [],
        },
        mockResponses: {},
      }),
      logger: createLogger(false),
      baseFetch,
    });

    const response = await fetch("https://unknown.example", {
      method: "GET",
    });

    expect(baseFetch).toHaveBeenCalledTimes(1);
    await expect(response.text()).resolves.toBe("ok");
  });

  it("applies latest snapshot on every fetch call", async () => {
    const snapshot = {
      mode: "strict" as const,
      routing: {
        rpcEndpoints: [
          {
            urlPattern: "https://rpc.example",
            methods: ["eth_chainId"],
            responseKey: "chain-id",
          },
        ],
      },
      mockResponses: {
        "chain-id": { result: "0x1" },
      } as Record<string, unknown>,
    };

    const fetch = createInterceptedFetch({
      getSnapshot: () => snapshot,
      logger: createLogger(false),
    });

    const first = await fetch("https://rpc.example", {
      method: "POST",
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "eth_chainId",
      }),
    });

    await expect(first.json()).resolves.toMatchObject({ result: "0x1" });

    snapshot.mockResponses["chain-id"] = { result: "0x2" };
    const second = await fetch("https://rpc.example", {
      method: "POST",
      body: JSON.stringify({
        id: 2,
        jsonrpc: "2.0",
        method: "eth_chainId",
      }),
    });

    await expect(second.json()).resolves.toMatchObject({ result: "0x2" });
  });

  it("fulfills matched XHR route", async () => {
    const restore = installXhrInterceptor(
      normalizeRuntimeInterceptConfig({
        enable: true,
        intercept: {
          mode: "strict",
          routing: {
            httpEndpoints: [
              {
                urlPattern: "https://api.example/quote",
                method: "GET",
                responseKey: "quote",
              },
            ],
          },
          mockResponses: {
            quote: {
              status: 200,
              body: {
                amountOut: "123.45",
              },
            },
          },
        },
      }),
      createLogger(false),
    );

    const xhr = new (globalThis as { XMLHttpRequest: new () => XMLHttpRequest }).XMLHttpRequest();

    const completed = new Promise<void>((resolve, reject) => {
      xhr.onload = () => resolve();
      xhr.onerror = () => reject(new Error("xhr should not fail"));
    });

    xhr.open("GET", "https://api.example/quote");
    xhr.send();

    await completed;
    expect(xhr.status).toBe(200);
    expect(JSON.parse(xhr.responseText)).toEqual({
      amountOut: "123.45",
    });
    expect(FakeXMLHttpRequest.instances).toHaveLength(0);

    restore();
  });

  it("blocks unmatched XHR in strict mode", () => {
    const restore = installXhrInterceptor(
      normalizeRuntimeInterceptConfig({
        enable: true,
        intercept: {
          mode: "strict",
          routing: {
            httpEndpoints: [],
          },
          mockResponses: {},
        },
      }),
      createLogger(false),
    );

    const xhr = new (globalThis as { XMLHttpRequest: new () => XMLHttpRequest }).XMLHttpRequest();
    xhr.open("GET", "https://unknown.example");

    expect(() => xhr.send()).toThrow("blocked unmatched request");

    restore();
  });

  it("forwards unmatched XHR in permissive mode", async () => {
    const restore = installXhrInterceptor(
      normalizeRuntimeInterceptConfig({
        enable: true,
        intercept: {
          mode: "permissive",
          routing: {
            httpEndpoints: [],
          },
          mockResponses: {},
        },
      }),
      createLogger(false),
    );

    const xhr = new (globalThis as { XMLHttpRequest: new () => XMLHttpRequest }).XMLHttpRequest();
    xhr.open("POST", "https://unknown.example");
    xhr.send(JSON.stringify({ amount: 1 }));

    await waitForMicrotask();

    expect(FakeXMLHttpRequest.instances).toHaveLength(1);
    expect(FakeXMLHttpRequest.instances[0].url).toBe("https://unknown.example");
    expect(FakeXMLHttpRequest.instances[0].isSent).toBe(true);

    restore();
  });
});
