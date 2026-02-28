import {
  createRuntimeErrorEvent,
  createRuntimeEvent,
  isRecord,
  matchesPattern,
  readBodyPayload,
  resolveMock,
  stringifyUnknown,
} from "../matcher.js";
import type { RuntimeLogger } from "../logger.js";
import type {
  MockResponseMap,
  NormalizedRuntimeInterceptConfig,
  RoutingMode,
  RoutingConfig,
} from "../types.js";

type JsonRpcPayload = {
  id?: unknown;
  jsonrpc?: unknown;
  method?: unknown;
  params?: unknown;
};

type XhrLike = {
  readyState?: number;
  response?: unknown;
  responseText?: string;
  responseType?: XMLHttpRequestResponseType;
  status?: number;
  statusText?: string;
  open?: (...args: unknown[]) => void;
  send?: (...args: unknown[]) => void;
  abort?: () => void;
  setRequestHeader?: (name: string, value: string) => void;
  getAllResponseHeaders?: () => string;
  getResponseHeader?: (name: string) => string | null;
  onreadystatechange?: ((event: Event) => void) | null;
  onload?: ((event: Event) => void) | null;
  onerror?: ((event: Event) => void) | null;
  onabort?: ((event: Event) => void) | null;
};

type XhrConstructor = new () => XhrLike;

type RuntimeXhrEventHandler = ((event: Event) => void) | null;

type RuntimeXhrListener = EventListenerOrEventListenerObject;

function isRpcResponseShape(value: unknown): value is { result?: unknown; error?: unknown } {
  return isRecord(value) && ("result" in value || "error" in value);
}

function isHttpResponseShape(
  value: unknown,
): value is { status?: unknown; headers?: unknown; body?: unknown } {
  return isRecord(value) && ("status" in value || "headers" in value || "body" in value);
}

function toHeaderRecord(input: unknown): Record<string, string> {
  if (!isRecord(input)) {
    return {};
  }

  return Object.entries(input).reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value === "string") {
      acc[key.toLowerCase()] = value;
    }
    return acc;
  }, {});
}

function parseRawHeaders(raw: string): Record<string, string> {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .reduce<Record<string, string>>((acc, line) => {
      const index = line.indexOf(":");
      if (index <= 0) {
        return acc;
      }

      const name = line.slice(0, index).trim().toLowerCase();
      const value = line.slice(index + 1).trim();
      acc[name] = value;
      return acc;
    }, {});
}

function queue(task: () => void): void {
  if (typeof queueMicrotask === "function") {
    queueMicrotask(task);
    return;
  }

  setTimeout(task, 0);
}

export function installXhrInterceptor(
  config: NormalizedRuntimeInterceptConfig,
  logger: RuntimeLogger,
): () => void {
  const target = globalThis as { XMLHttpRequest?: XhrConstructor };
  const BaseXMLHttpRequest = target.XMLHttpRequest;
  if (!BaseXMLHttpRequest) {
    logger.debug("xhr.skip.no_base");
    return () => {
      logger.debug("xhr.restore.noop");
    };
  }
  const BaseXMLHttpRequestCtor = BaseXMLHttpRequest;

  class InterceptedXMLHttpRequest {
    static readonly UNSENT = 0;
    static readonly OPENED = 1;
    static readonly HEADERS_RECEIVED = 2;
    static readonly LOADING = 3;
    static readonly DONE = 4;

    readonly UNSENT = InterceptedXMLHttpRequest.UNSENT;
    readonly OPENED = InterceptedXMLHttpRequest.OPENED;
    readonly HEADERS_RECEIVED = InterceptedXMLHttpRequest.HEADERS_RECEIVED;
    readonly LOADING = InterceptedXMLHttpRequest.LOADING;
    readonly DONE = InterceptedXMLHttpRequest.DONE;

    onreadystatechange: RuntimeXhrEventHandler = null;
    onload: RuntimeXhrEventHandler = null;
    onerror: RuntimeXhrEventHandler = null;
    onabort: RuntimeXhrEventHandler = null;

    readyState = InterceptedXMLHttpRequest.UNSENT;
    status = 0;
    statusText = "";
    response: unknown = null;
    responseText = "";
    responseType: XMLHttpRequestResponseType = "";

    private method = "GET";
    private url = "";
    private async = true;
    private requestBody: BodyInit | null = null;
    private requestHeaders = new Map<string, string>();
    private responseHeaders = new Map<string, string>();
    private listeners = new Map<string, Set<RuntimeXhrListener>>();
    private passthrough: XhrLike | null = null;

    open(method: string, url: string, async = true): void {
      this.method = method.toUpperCase();
      this.url = url;
      this.async = async;
      this.readyState = InterceptedXMLHttpRequest.OPENED;
      this.emit("readystatechange");
    }

    setRequestHeader(name: string, value: string): void {
      this.requestHeaders.set(name.toLowerCase(), value);
    }

    addEventListener(type: string, listener: RuntimeXhrListener): void {
      const bucket = this.listeners.get(type) ?? new Set<RuntimeXhrListener>();
      bucket.add(listener);
      this.listeners.set(type, bucket);
    }

    removeEventListener(type: string, listener: RuntimeXhrListener): void {
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

    getResponseHeader(name: string): string | null {
      return this.responseHeaders.get(name.toLowerCase()) ?? null;
    }

    getAllResponseHeaders(): string {
      return Array.from(this.responseHeaders.entries())
        .map(([name, value]) => `${name}: ${value}`)
        .join("\r\n");
    }

    overrideMimeType(): void {
      return;
    }

    abort(): void {
      if (this.passthrough && typeof this.passthrough.abort === "function") {
        this.passthrough.abort();
      }

      this.readyState = InterceptedXMLHttpRequest.DONE;
      this.emit("abort");
    }

    send(body: Document | XMLHttpRequestBodyInit | null = null): void {
      this.requestBody = body as BodyInit | null;

      const payload = typeof body === "string" ? readBodyPayload(body) : undefined;
      const rpcEndpoint = config.intercept.routing.rpcEndpoints.find((endpoint) => {
        if (!matchesPattern(this.url, endpoint.urlPattern)) {
          return false;
        }

        if (!endpoint.methods || endpoint.methods.length === 0) {
          return true;
        }

        if (!isRecord(payload) || typeof payload.method !== "string") {
          return false;
        }

        return endpoint.methods.includes(payload.method);
      });

      if (rpcEndpoint) {
        void resolveMock(config.intercept.mockResponses[rpcEndpoint.responseKey], {
          url: this.url,
          method: this.method,
          payload,
          endpointType: "rpc",
        }).then((response) => {
          if (response === undefined && config.intercept.mode === "strict") {
            logger.debug("xhr.rpc.blocked", {
              url: this.url,
              method: this.method,
            });
            this.fail(`Luna runtime intercept blocked RPC request: ${this.url}`);
            return;
          }

          if (response === undefined) {
            this.forwardToBase();
            return;
          }

          const rpcPayload = isRecord(payload) ? (payload as JsonRpcPayload) : {};
          const envelope = isRpcResponseShape(response)
            ? {
                jsonrpc: "2.0",
                id: rpcPayload.id ?? null,
                ...(response.error !== undefined
                  ? { error: response.error }
                  : { result: response.result }),
              }
            : {
                jsonrpc: "2.0",
                id: rpcPayload.id ?? null,
                result: response,
              };

          logger.debug("xhr.rpc.hit", {
            url: this.url,
            method: this.method,
            key: rpcEndpoint.responseKey,
          });

          this.fulfill(200, { "content-type": "application/json" }, JSON.stringify(envelope));
        });

        return;
      }

      const httpEndpoint = config.intercept.routing.httpEndpoints.find((endpoint) => {
        if (!matchesPattern(this.url, endpoint.urlPattern)) {
          return false;
        }

        if (!endpoint.method) {
          return true;
        }

        return endpoint.method.toUpperCase() === this.method;
      });

      if (httpEndpoint) {
        void resolveMock(config.intercept.mockResponses[httpEndpoint.responseKey], {
          url: this.url,
          method: this.method,
          payload,
          endpointType: "http",
        }).then((response) => {
          if (response === undefined && config.intercept.mode === "strict") {
            logger.debug("xhr.http.blocked", {
              url: this.url,
              method: this.method,
            });
            this.fail(`Luna runtime intercept blocked HTTP request: ${this.url}`);
            return;
          }

          if (response === undefined) {
            this.forwardToBase();
            return;
          }

          const normalized = isHttpResponseShape(response)
            ? {
                status: typeof response.status === "number" ? response.status : 200,
                headers: toHeaderRecord(response.headers),
                body: "body" in response ? response.body : null,
              }
            : {
                status: 200,
                headers: {},
                body: response,
              };

          const payloadText = stringifyUnknown(normalized.body);
          const contentType =
            typeof normalized.body === "string"
              ? normalized.headers["content-type"] ?? "text/plain"
              : normalized.headers["content-type"] ?? "application/json";

          logger.debug("xhr.http.hit", {
            url: this.url,
            method: this.method,
            key: httpEndpoint.responseKey,
          });

          this.fulfill(
            normalized.status,
            {
              ...normalized.headers,
              "content-type": contentType,
            },
            payloadText,
          );
        });

        return;
      }

      if (config.intercept.mode === "strict") {
        logger.debug("xhr.unmatched.blocked", {
          url: this.url,
          method: this.method,
        });
        this.fail(`Luna runtime intercept blocked unmatched request: ${this.method} ${this.url}`);
        throw new Error(`Luna runtime intercept blocked unmatched request: ${this.method} ${this.url}`);
      }

      logger.debug("xhr.unmatched.forward", {
        url: this.url,
        method: this.method,
      });

      this.forwardToBase();
    }

    private forwardToBase(): void {
      const base = new BaseXMLHttpRequestCtor();
      this.passthrough = base;

      base.onreadystatechange = () => {
        this.syncFromBase(base);
        this.emit("readystatechange");
      };

      base.onload = () => {
        this.syncFromBase(base);
        this.emit("load");
      };

      base.onerror = () => {
        this.syncFromBase(base);
        this.emit("error", createRuntimeErrorEvent(this));
      };

      base.onabort = () => {
        this.syncFromBase(base);
        this.emit("abort");
      };

      base.open?.(this.method, this.url, this.async);
      for (const [name, value] of this.requestHeaders.entries()) {
        base.setRequestHeader?.(name, value);
      }
      base.send?.(this.requestBody);
    }

    private syncFromBase(base: XhrLike): void {
      this.readyState = typeof base.readyState === "number" ? base.readyState : this.readyState;
      this.status = typeof base.status === "number" ? base.status : this.status;
      this.statusText = typeof base.statusText === "string" ? base.statusText : this.statusText;
      this.responseText = typeof base.responseText === "string" ? base.responseText : this.responseText;
      this.response = base.response ?? this.responseText;

      const rawHeaders = base.getAllResponseHeaders?.();
      if (rawHeaders) {
        this.responseHeaders = new Map<string, string>(Object.entries(parseRawHeaders(rawHeaders)));
      }
    }

    private fulfill(status: number, headers: Record<string, string>, body: string): void {
      const apply = () => {
        this.status = status;
        this.statusText = status >= 200 && status < 300 ? "OK" : "ERROR";
        this.responseHeaders = new Map<string, string>(
          Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]),
        );

        this.readyState = InterceptedXMLHttpRequest.HEADERS_RECEIVED;
        this.emit("readystatechange");

        this.readyState = InterceptedXMLHttpRequest.LOADING;
        this.emit("readystatechange");

        this.readyState = InterceptedXMLHttpRequest.DONE;
        this.responseText = body;

        if (this.responseType === "json") {
          try {
            this.response = JSON.parse(body);
          } catch {
            this.response = null;
          }
        } else {
          this.response = body;
        }

        this.emit("readystatechange");
        this.emit("load");
      };

      if (this.async) {
        queue(apply);
      } else {
        apply();
      }
    }

    private fail(message: string): void {
      this.readyState = InterceptedXMLHttpRequest.DONE;
      this.status = 0;
      this.statusText = "";
      this.response = null;
      this.responseText = "";
      this.emit("readystatechange");
      this.emit("error", createRuntimeErrorEvent(this));
      logger.debug("xhr.error", {
        url: this.url,
        method: this.method,
        message,
      });
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

      const handlerName = `on${type}` as const;
      const handler = this[handlerName as keyof this] as RuntimeXhrEventHandler;
      if (typeof handler === "function") {
        handler.call(this, event);
      }
    }
  }

  target.XMLHttpRequest = InterceptedXMLHttpRequest as unknown as XhrConstructor;
  logger.debug("xhr.installed");

  return () => {
    target.XMLHttpRequest = BaseXMLHttpRequest;
    logger.debug("xhr.restored");
  };
}

export function createXhrInterceptor(input: {
  mode: RoutingMode;
  routing: RoutingConfig;
  mockResponses: MockResponseMap;
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

  return installXhrInterceptor(normalizedConfig, input.logger);
}
