import {
  createRuntimeErrorEvent,
  createRuntimeEvent,
  createRuntimeMessageEvent,
  matchesPattern,
  readWsPayload,
  resolveMock,
  stringifyUnknown,
} from "../matcher";
import type { RuntimeLogger } from "../logger";
import type {
  EndpointPattern,
  NormalizedRuntimeInterceptConfig,
  RoutingMode,
  RoutingConfig,
  WsEndpointRoute,
} from "../types";

type RuntimeWebSocketListener = EventListenerOrEventListenerObject;

type WebSocketLike = {
  binaryType?: BinaryType;
  bufferedAmount?: number;
  extensions?: string;
  protocol?: string;
  readyState?: number;
  url?: string;
  send?: (data: unknown) => void;
  close?: (code?: number, reason?: string) => void;
  addEventListener?: (type: string, listener: RuntimeWebSocketListener) => void;
  removeEventListener?: (type: string, listener: RuntimeWebSocketListener) => void;
  onopen?: ((event: Event) => void) | null;
  onerror?: ((event: Event) => void) | null;
  onclose?: ((event: Event) => void) | null;
  onmessage?: ((event: MessageEvent) => void) | null;
};

type WebSocketConstructor = new (url: string | URL, protocols?: string | string[]) => WebSocketLike;

type EventHandler = ((event: Event) => void) | null;
type MessageHandler = ((event: MessageEvent) => void) | null;

function queue(task: () => void): void {
  if (typeof queueMicrotask === "function") {
    queueMicrotask(task);
    return;
  }

  setTimeout(task, 0);
}

function frameMatches(rawFrame: string, parsedFrame: unknown, pattern: EndpointPattern): boolean {
  if (matchesPattern(rawFrame, pattern)) {
    return true;
  }

  if (typeof parsedFrame === "string") {
    return matchesPattern(parsedFrame, pattern);
  }

  if (parsedFrame !== undefined) {
    return matchesPattern(stringifyUnknown(parsedFrame), pattern);
  }

  return false;
}

function pickRoute(rawFrame: string, parsedFrame: unknown, routes: WsEndpointRoute[]): WsEndpointRoute | undefined {
  for (const route of routes) {
    if (!route.match) {
      return route;
    }

    if (frameMatches(rawFrame, parsedFrame, route.match)) {
      return route;
    }
  }

  return undefined;
}

export function installWebSocketInterceptor(
  config: NormalizedRuntimeInterceptConfig,
  logger: RuntimeLogger,
): () => void {
  const target = globalThis as { WebSocket?: WebSocketConstructor };
  const BaseWebSocket = target.WebSocket;
  if (!BaseWebSocket) {
    logger.debug("ws.skip.no_base");
    return () => {
      logger.debug("ws.restore.noop");
    };
  }
  const BaseWebSocketCtor = BaseWebSocket;

  class InterceptedWebSocket {
    static readonly CONNECTING = (BaseWebSocketCtor as unknown as typeof WebSocket).CONNECTING ?? 0;
    static readonly OPEN = (BaseWebSocketCtor as unknown as typeof WebSocket).OPEN ?? 1;
    static readonly CLOSING = (BaseWebSocketCtor as unknown as typeof WebSocket).CLOSING ?? 2;
    static readonly CLOSED = (BaseWebSocketCtor as unknown as typeof WebSocket).CLOSED ?? 3;

    readonly CONNECTING = InterceptedWebSocket.CONNECTING;
    readonly OPEN = InterceptedWebSocket.OPEN;
    readonly CLOSING = InterceptedWebSocket.CLOSING;
    readonly CLOSED = InterceptedWebSocket.CLOSED;

    onopen: EventHandler = null;
    onerror: EventHandler = null;
    onclose: EventHandler = null;
    onmessage: MessageHandler = null;

    private readonly listeners = new Map<string, Set<RuntimeWebSocketListener>>();
    private readonly baseSocket: WebSocketLike;
    private readonly socketUrl: string;
    private readonly bypassed: boolean;
    private readonly candidateRoutes: WsEndpointRoute[];

    constructor(url: string | URL, protocols?: string | string[]) {
      const normalizedUrl = typeof url === "string" ? url : url.toString();
      const bypassed = config.intercept.routing.bypassWsPatterns.some((pattern) =>
        matchesPattern(normalizedUrl, pattern),
      );
      const candidateRoutes = config.intercept.routing.wsEndpoints.filter((endpoint) =>
        matchesPattern(normalizedUrl, endpoint.urlPattern),
      );

      if (!bypassed && candidateRoutes.length === 0 && config.intercept.mode === "strict") {
        logger.debug("ws.unmatched.blocked", {
          url: normalizedUrl,
        });
        throw new Error(`Luna runtime intercept blocked unmatched websocket: ${normalizedUrl}`);
      }

      this.baseSocket = new BaseWebSocketCtor(url, protocols);
      this.socketUrl = this.baseSocket.url ?? normalizedUrl;
      this.bypassed = bypassed;
      this.candidateRoutes = candidateRoutes;

      this.bindBaseEvents();

      logger.debug("ws.socket.open", {
        url: this.socketUrl,
        bypassed,
        routeCount: candidateRoutes.length,
      });
    }

    get url(): string {
      return this.baseSocket.url ?? this.socketUrl;
    }

    get readyState(): number {
      return this.baseSocket.readyState ?? InterceptedWebSocket.OPEN;
    }

    get protocol(): string {
      return this.baseSocket.protocol ?? "";
    }

    get extensions(): string {
      return this.baseSocket.extensions ?? "";
    }

    get bufferedAmount(): number {
      return this.baseSocket.bufferedAmount ?? 0;
    }

    get binaryType(): BinaryType {
      return this.baseSocket.binaryType ?? "blob";
    }

    set binaryType(value: BinaryType) {
      this.baseSocket.binaryType = value;
    }

    send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
      if (this.bypassed) {
        this.baseSocket.send?.(data);
        return;
      }

      if (this.candidateRoutes.length === 0) {
        if (config.intercept.mode === "strict") {
          logger.debug("ws.frame.blocked.unmatched", {
            url: this.url,
          });
          throw new Error(`Luna runtime intercept blocked websocket frame: ${this.url}`);
        }

        this.baseSocket.send?.(data);
        return;
      }

      const rawFrame = typeof data === "string" ? data : stringifyUnknown(data);
      const parsedFrame = readWsPayload(rawFrame);
      const route = pickRoute(rawFrame, parsedFrame, this.candidateRoutes);

      if (!route) {
        if (config.intercept.mode === "strict") {
          logger.debug("ws.frame.blocked.no_match", {
            url: this.url,
          });
          throw new Error(`Luna runtime intercept blocked unmatched websocket frame: ${this.url}`);
        }

        logger.debug("ws.frame.forward.no_match", {
          url: this.url,
        });
        this.baseSocket.send?.(data);
        return;
      }

      void resolveMock(config.intercept.mockResponses[route.responseKey], {
        url: this.url,
        method: "WS_SEND",
        payload: parsedFrame,
        endpointType: "ws",
      })
        .then((response) => {
          if (response === undefined) {
            if (config.intercept.mode === "strict") {
              logger.debug("ws.frame.blocked.no_response", {
                url: this.url,
                key: route.responseKey,
              });
              this.emit("error", createRuntimeErrorEvent(this));
              this.baseSocket.close?.(4401, "lunatest.ws.blocked");
              return;
            }

            this.baseSocket.send?.(data);
            return;
          }

          logger.debug("ws.frame.hit", {
            url: this.url,
            key: route.responseKey,
          });

          const messagePayload = typeof response === "string" ? response : stringifyUnknown(response);
          queue(() => {
            this.emit("message", createRuntimeMessageEvent(messagePayload, this));
          });
        })
        .catch((error) => {
          logger.debug("ws.frame.error", {
            url: this.url,
            message: error instanceof Error ? error.message : String(error),
          });
          this.emit("error", createRuntimeErrorEvent(this));
        });
    }

    close(code?: number, reason?: string): void {
      this.baseSocket.close?.(code, reason);
    }

    addEventListener(type: string, listener: RuntimeWebSocketListener): void {
      const bucket = this.listeners.get(type) ?? new Set<RuntimeWebSocketListener>();
      bucket.add(listener);
      this.listeners.set(type, bucket);
    }

    removeEventListener(type: string, listener: RuntimeWebSocketListener): void {
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
      this.emit(event.type, event);
      return true;
    }

    private bindBaseEvents(): void {
      if (typeof this.baseSocket.addEventListener === "function") {
        this.baseSocket.addEventListener("open", (event) => {
          this.emit("open", event as Event);
        });

        this.baseSocket.addEventListener("close", (event) => {
          this.emit("close", event as Event);
        });

        this.baseSocket.addEventListener("error", (event) => {
          this.emit("error", event as Event);
        });

        this.baseSocket.addEventListener("message", (event) => {
          this.emit("message", event as Event);
        });
        return;
      }

      this.baseSocket.onopen = (event) => {
        this.emit("open", event);
      };

      this.baseSocket.onclose = (event) => {
        this.emit("close", event);
      };

      this.baseSocket.onerror = (event) => {
        this.emit("error", event);
      };

      this.baseSocket.onmessage = (event) => {
        this.emit("message", event);
      };
    }

    private emit(type: string, rawEvent?: Event): void {
      const event = rawEvent ?? createRuntimeEvent(type, this);
      const listeners = this.listeners.get(type);
      if (listeners) {
        for (const listener of listeners) {
          if (typeof listener === "function") {
            listener.call(this, event);
          } else {
            listener.handleEvent(event);
          }
        }
      }

      if (type === "message") {
        const messageHandler = this.onmessage;
        if (typeof messageHandler === "function") {
          messageHandler.call(this, event as MessageEvent);
        }
        return;
      }

      const handlerName = `on${type}` as const;
      const handler = this[handlerName as keyof this] as EventHandler;
      if (typeof handler === "function") {
        handler.call(this, event);
      }
    }
  }

  target.WebSocket = InterceptedWebSocket as unknown as WebSocketConstructor;
  logger.debug("ws.installed");

  return () => {
    target.WebSocket = BaseWebSocket;
    logger.debug("ws.restored");
  };
}

export function createWebSocketInterceptor(input: {
  mode: RoutingMode;
  routing: RoutingConfig;
  mockResponses: Record<string, unknown>;
  logger: RuntimeLogger;
}): () => void {
  const normalizedConfig: NormalizedRuntimeInterceptConfig = {
    debug: false,
    enable: true,
    intercept: {
      mode: input.mode,
      routing: {
        ethereumMethods: input.routing.ethereumMethods ?? [],
        rpcEndpoints: input.routing.rpcEndpoints ?? [],
        httpEndpoints: input.routing.httpEndpoints ?? [],
        wsEndpoints: input.routing.wsEndpoints ?? [],
        bypassWsPatterns: input.routing.bypassWsPatterns ?? [],
      },
      mockResponses: input.mockResponses,
    },
  };

  return installWebSocketInterceptor(normalizedConfig, input.logger);
}
