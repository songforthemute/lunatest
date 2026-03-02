import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installWebSocketInterceptor } from "../interceptors/websocket";
import { createLogger } from "../logger";
import { normalizeRuntimeInterceptConfig } from "../runtime";

function waitForMicrotask(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readonly CONNECTING = FakeWebSocket.CONNECTING;
  readonly OPEN = FakeWebSocket.OPEN;
  readonly CLOSING = FakeWebSocket.CLOSING;
  readonly CLOSED = FakeWebSocket.CLOSED;

  binaryType: BinaryType = "blob";
  bufferedAmount = 0;
  extensions = "";
  protocol = "";
  readyState = FakeWebSocket.OPEN;
  url: string;

  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  sent: unknown[] = [];

  private listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();

  constructor(url: string | URL) {
    this.url = typeof url === "string" ? url : url.toString();
    FakeWebSocket.instances.push(this);

    queueMicrotask(() => {
      const event = new Event("open");
      this.dispatch("open", event);
    });
  }

  send(data: unknown): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.dispatch("close", new Event("close"));
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const bucket = this.listeners.get(type) ?? new Set<EventListenerOrEventListenerObject>();
    bucket.add(listener);
    this.listeners.set(type, bucket);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const bucket = this.listeners.get(type);
    if (!bucket) {
      return;
    }

    bucket.delete(listener);
    if (bucket.size === 0) {
      this.listeners.delete(type);
    }
  }

  dispatchEvent(event: Event): boolean {
    this.dispatch(event.type, event);
    return true;
  }

  private dispatch(type: string, event: Event): void {
    const bucket = this.listeners.get(type);
    if (bucket) {
      for (const listener of bucket) {
        if (typeof listener === "function") {
          listener.call(this, event);
        } else {
          listener.handleEvent(event);
        }
      }
    }

    const handler = this[`on${type}` as "onopen" | "onclose" | "onerror" | "onmessage"];
    if (typeof handler === "function") {
      handler.call(this, event as MessageEvent);
    }
  }
}

describe("websocket interceptor", () => {
  const target = globalThis as {
    WebSocket?: unknown;
  };

  const originalWebSocket = target.WebSocket;

  beforeEach(() => {
    FakeWebSocket.instances = [];
    target.WebSocket = FakeWebSocket as unknown as WebSocket;
  });

  afterEach(() => {
    target.WebSocket = originalWebSocket;
  });

  it("dispatches mocked frame response on send", async () => {
    const restore = installWebSocketInterceptor(
      normalizeRuntimeInterceptConfig({
        enable: true,
        intercept: {
          mode: "strict",
          routing: {
            wsEndpoints: [
              {
                urlPattern: "wss://stream.local/socket",
                match: "SUBSCRIBE_QUOTE",
                responseKey: "ws.quote",
              },
            ],
          },
          mockResponses: {
            "ws.quote": {
              type: "QUOTE_UPDATED",
              amountOut: "123.45",
            },
          },
        },
      }),
      createLogger(false),
    );

    const ws = new (target as { WebSocket: new (url: string) => WebSocket }).WebSocket(
      "wss://stream.local/socket",
    );

    const received: string[] = [];
    ws.addEventListener("message", (event) => {
      received.push((event as MessageEvent).data as string);
    });

    ws.send(JSON.stringify({ type: "SUBSCRIBE_QUOTE" }));
    await waitForMicrotask();

    expect(received).toHaveLength(1);
    expect(JSON.parse(received[0])).toEqual({
      type: "QUOTE_UPDATED",
      amountOut: "123.45",
    });
    expect(FakeWebSocket.instances[0].sent).toHaveLength(0);

    restore();
  });

  it("blocks unmatched frame in strict mode", () => {
    const restore = installWebSocketInterceptor(
      normalizeRuntimeInterceptConfig({
        enable: true,
        intercept: {
          mode: "strict",
          routing: {
            wsEndpoints: [
              {
                urlPattern: "wss://stream.local/socket",
                match: "SUBSCRIBE_QUOTE",
                responseKey: "ws.quote",
              },
            ],
          },
          mockResponses: {
            "ws.quote": {
              type: "QUOTE_UPDATED",
            },
          },
        },
      }),
      createLogger(false),
    );

    const ws = new (target as { WebSocket: new (url: string) => WebSocket }).WebSocket(
      "wss://stream.local/socket",
    );

    expect(() => ws.send(JSON.stringify({ type: "UNMATCHED" }))).toThrow(
      "blocked unmatched websocket frame",
    );

    restore();
  });

  it("bypasses HMR channel even in strict mode", () => {
    const restore = installWebSocketInterceptor(
      normalizeRuntimeInterceptConfig({
        enable: true,
        intercept: {
          mode: "strict",
          routing: {
            wsEndpoints: [],
          },
          mockResponses: {},
        },
      }),
      createLogger(false),
    );

    const ws = new (target as { WebSocket: new (url: string) => WebSocket }).WebSocket(
      "ws://localhost:5173/vite-hmr",
    );

    ws.send("ping");

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0].sent).toEqual(["ping"]);

    restore();
  });

  it("forwards unmatched websocket in permissive mode", () => {
    const restore = installWebSocketInterceptor(
      normalizeRuntimeInterceptConfig({
        enable: true,
        intercept: {
          mode: "permissive",
          routing: {
            wsEndpoints: [],
          },
          mockResponses: {},
        },
      }),
      createLogger(false),
    );

    const ws = new (target as { WebSocket: new (url: string) => WebSocket }).WebSocket(
      "wss://unknown.example/socket",
    );

    ws.send("raw-frame");

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0].sent).toEqual(["raw-frame"]);

    restore();
  });
});
