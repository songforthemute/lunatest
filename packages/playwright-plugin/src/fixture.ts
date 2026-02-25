export type RoutingMode = "strict" | "permissive";

export type RpcEndpointRoute = {
  urlPattern: string | RegExp;
  methods?: string[];
  responseKey: string;
};

export type HttpEndpointRoute = {
  urlPattern: string | RegExp;
  method?: string;
  responseKey: string;
};

export type RoutingConfig = {
  mode?: RoutingMode;
  rpcEndpoints?: RpcEndpointRoute[];
  httpEndpoints?: HttpEndpointRoute[];
};

type MockResolverContext = {
  url: string;
  method: string;
  payload?: unknown;
  endpointType: "rpc" | "http";
};

type MockResponseInput =
  | unknown
  | ((context: MockResolverContext) => unknown)
  | Promise<unknown>;

type MockResponseMap = Record<string, MockResponseInput>;

type JsonRpcPayload = {
  id?: unknown;
  jsonrpc?: unknown;
  method?: unknown;
  params?: unknown;
};

type PlaywrightLikeRequest = {
  url: () => string;
  method: () => string;
  postDataJSON?: () => unknown;
  postData?: () => string | null;
};

type PlaywrightLikeRoute = {
  request: () => PlaywrightLikeRequest;
  fulfill: (input: {
    status?: number;
    contentType?: string;
    headers?: Record<string, string>;
    body?: string;
  }) => Promise<void> | void;
  continue: () => Promise<void> | void;
  abort: () => Promise<void> | void;
};

export type PlaywrightRouteTarget = {
  route: (
    url: string | RegExp,
    handler: (route: PlaywrightLikeRoute) => Promise<void>,
  ) => Promise<void> | void;
};

export type InitScriptTarget = {
  addInitScript: (script: string) => Promise<void> | void;
};

export type LunaFixture = {
  injectProvider: (target?: InitScriptTarget) => Promise<void>;
  installRouting: (target: PlaywrightRouteTarget) => Promise<void>;
};

export type LunaFixtureOptions = {
  routing?: RoutingConfig;
  mockResponses?: MockResponseMap;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\\*\\\*/g, ".*")
    .replace(/\\\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function matchesPattern(url: string, pattern: string | RegExp): boolean {
  if (pattern instanceof RegExp) {
    return pattern.test(url);
  }

  if (pattern.includes("*")) {
    return patternToRegExp(pattern).test(url);
  }

  return url === pattern || url.includes(pattern);
}

function readJsonPayload(request: PlaywrightLikeRequest): unknown {
  if (typeof request.postDataJSON === "function") {
    try {
      return request.postDataJSON();
    } catch {
      return undefined;
    }
  }

  if (typeof request.postData === "function") {
    const raw = request.postData();
    if (!raw) {
      return undefined;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function serializeBody(value: unknown): { body: string; contentType: string } {
  if (typeof value === "string") {
    return {
      body: value,
      contentType: "text/plain",
    };
  }

  return {
    body: JSON.stringify(value ?? null),
    contentType: "application/json",
  };
}

function isRpcResponseShape(
  value: unknown,
): value is { result?: unknown; error?: unknown } {
  return isRecord(value) && ("result" in value || "error" in value);
}

function isHttpResponseShape(
  value: unknown,
): value is { status?: unknown; headers?: unknown; body?: unknown } {
  return isRecord(value) && ("status" in value || "headers" in value || "body" in value);
}

async function resolveMock(
  source: MockResponseInput | undefined,
  context: MockResolverContext,
): Promise<unknown> {
  if (typeof source === "function") {
    return (source as (input: MockResolverContext) => unknown)(context);
  }

  return source;
}

function createInjectedProviderScript(): string {
  return `
(() => {
  const listeners = new Map();
  const api = {
    isLunaTest: true,
    request: async ({ method }) => {
      throw new Error(\`LunaTest injected provider has no handler for \${method}\`);
    },
    on: (event, listener) => {
      const bucket = listeners.get(event) ?? [];
      bucket.push(listener);
      listeners.set(event, bucket);
      return api;
    },
    removeListener: (event, listener) => {
      const bucket = listeners.get(event) ?? [];
      listeners.set(
        event,
        bucket.filter((item) => item !== listener),
      );
      return api;
    },
  };
  Object.defineProperty(window, "ethereum", {
    configurable: true,
    writable: true,
    value: api,
  });
  window.ethereum = api;
})();
`;
}

export function createLunaFixture(options: LunaFixtureOptions = {}): LunaFixture {
  const routingMode: RoutingMode = options.routing?.mode ?? "permissive";
  const rpcEndpoints = options.routing?.rpcEndpoints ?? [];
  const httpEndpoints = options.routing?.httpEndpoints ?? [];
  const mockResponses = options.mockResponses ?? {};

  return {
    async injectProvider(target?: InitScriptTarget) {
      if (!target) {
        return;
      }

      await target.addInitScript(createInjectedProviderScript());
    },

    async installRouting(target: PlaywrightRouteTarget) {
      await target.route("**/*", async (route) => {
        const request = route.request();
        const url = request.url();
        const method = request.method().toUpperCase();
        const payload = readJsonPayload(request);

        const rpcEndpoint = rpcEndpoints.find((endpoint) => {
          if (!matchesPattern(url, endpoint.urlPattern)) {
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
          const response = await resolveMock(mockResponses[rpcEndpoint.responseKey], {
            url,
            method,
            payload,
            endpointType: "rpc",
          });

          if (response === undefined && routingMode === "strict") {
            await route.abort();
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

          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(envelope),
          });
          return;
        }

        const httpEndpoint = httpEndpoints.find((endpoint) => {
          if (!matchesPattern(url, endpoint.urlPattern)) {
            return false;
          }
          if (!endpoint.method) {
            return true;
          }
          return endpoint.method.toUpperCase() === method;
        });

        if (httpEndpoint) {
          const response = await resolveMock(mockResponses[httpEndpoint.responseKey], {
            url,
            method,
            payload,
            endpointType: "http",
          });

          if (response === undefined && routingMode === "strict") {
            await route.abort();
            return;
          }

          const normalized = isHttpResponseShape(response)
            ? {
                status:
                  typeof response.status === "number"
                    ? response.status
                    : 200,
                headers: isRecord(response.headers)
                  ? (response.headers as Record<string, string>)
                  : undefined,
                body: "body" in response ? response.body : null,
              }
            : {
                status: 200,
                headers: undefined,
                body: response,
              };

          const body = serializeBody(normalized.body);
          await route.fulfill({
            status: normalized.status,
            headers: normalized.headers,
            contentType: body.contentType,
            body: body.body,
          });
          return;
        }

        if (routingMode === "strict") {
          await route.abort();
          return;
        }

        await route.continue();
      });
    },
  };
}
