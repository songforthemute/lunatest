import type {
  MockResponseMap,
  NormalizedRuntimeInterceptConfig,
  RoutingMode,
  RoutingConfig,
} from "../types.js";
import type { RuntimeLogger } from "../logger.js";
import {
  createJsonResponse,
  isRecord,
  matchesPattern,
  readBodyPayload,
  resolveMock,
} from "../matcher.js";

type JsonRpcPayload = {
  id?: unknown;
  jsonrpc?: unknown;
  method?: unknown;
  params?: unknown;
};

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type InterceptFetchSnapshot = {
  mode: RoutingMode;
  routing: RoutingConfig;
  mockResponses: MockResponseMap;
};

function extractRequest(input: RequestInfo | URL, init?: RequestInit): {
  url: string;
  method: string;
  payload: unknown;
} {
  const method = (init?.method ?? "GET").toUpperCase();

  if (typeof Request !== "undefined" && input instanceof Request) {
    return {
      url: input.url,
      method: (init?.method ?? input.method ?? "GET").toUpperCase(),
      payload: readBodyPayload(init?.body ?? null),
    };
  }

  const url = typeof input === "string" ? input : input.toString();
  const payload = readBodyPayload(init?.body ?? null);

  return {
    url,
    method,
    payload,
  };
}

function isRpcResponseShape(value: unknown): value is { result?: unknown; error?: unknown } {
  return isRecord(value) && ("result" in value || "error" in value);
}

function isHttpResponseShape(
  value: unknown,
): value is { status?: unknown; headers?: unknown; body?: unknown } {
  return isRecord(value) && ("status" in value || "headers" in value || "body" in value);
}

function noBaseFetchError(url: string): Error {
  return new Error(`Luna runtime intercept cannot forward fetch without base fetch: ${url}`);
}

export function createInterceptedFetch(options: {
  getSnapshot: () => InterceptFetchSnapshot;
  logger: RuntimeLogger;
  baseFetch?: FetchLike;
}): FetchLike {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = extractRequest(input, init);
    const snapshot = options.getSnapshot();
    const routingMode = snapshot.mode;
    const rpcEndpoints = snapshot.routing.rpcEndpoints ?? [];
    const httpEndpoints = snapshot.routing.httpEndpoints ?? [];

    const rpcEndpoint = rpcEndpoints.find((endpoint) => {
      if (!matchesPattern(request.url, endpoint.urlPattern)) {
        return false;
      }

      if (!endpoint.methods || endpoint.methods.length === 0) {
        return true;
      }

      if (!isRecord(request.payload) || typeof request.payload.method !== "string") {
        return false;
      }

      return endpoint.methods.includes(request.payload.method);
    });

    if (rpcEndpoint) {
      const response = await resolveMock(snapshot.mockResponses[rpcEndpoint.responseKey], {
        url: request.url,
        method: request.method,
        payload: request.payload,
        endpointType: "rpc",
      });

      if (response === undefined && routingMode === "strict") {
        options.logger.debug("fetch.rpc.blocked", {
          url: request.url,
          method: request.method,
        });
        throw new Error(`Luna runtime intercept blocked RPC request: ${request.url}`);
      }

      const rpcPayload = isRecord(request.payload)
        ? (request.payload as JsonRpcPayload)
        : ({} as JsonRpcPayload);

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

      options.logger.debug("fetch.rpc.hit", {
        url: request.url,
        method: request.method,
        key: rpcEndpoint.responseKey,
      });

      return createJsonResponse(JSON.stringify(envelope), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }

    const httpEndpoint = httpEndpoints.find((endpoint) => {
      if (!matchesPattern(request.url, endpoint.urlPattern)) {
        return false;
      }

      if (!endpoint.method) {
        return true;
      }

      return endpoint.method.toUpperCase() === request.method;
    });

    if (httpEndpoint) {
      const response = await resolveMock(snapshot.mockResponses[httpEndpoint.responseKey], {
        url: request.url,
        method: request.method,
        payload: request.payload,
        endpointType: "http",
      });

      if (response === undefined && routingMode === "strict") {
        options.logger.debug("fetch.http.blocked", {
          url: request.url,
          method: request.method,
        });
        throw new Error(`Luna runtime intercept blocked HTTP request: ${request.url}`);
      }

      const normalized = isHttpResponseShape(response)
        ? {
            status: typeof response.status === "number" ? response.status : 200,
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

      const payload =
        typeof normalized.body === "string"
          ? normalized.body
          : JSON.stringify(normalized.body ?? null);

      options.logger.debug("fetch.http.hit", {
        url: request.url,
        method: request.method,
        key: httpEndpoint.responseKey,
      });

      return createJsonResponse(payload, {
        status: normalized.status,
        headers: {
          "content-type": typeof normalized.body === "string" ? "text/plain" : "application/json",
          ...(normalized.headers ?? {}),
        },
      });
    }

    if (routingMode === "strict") {
      options.logger.debug("fetch.unmatched.blocked", {
        url: request.url,
        method: request.method,
      });
      throw new Error(`Luna runtime intercept blocked unmatched request: ${request.method} ${request.url}`);
    }

    options.logger.debug("fetch.unmatched.forward", {
      url: request.url,
      method: request.method,
    });

    if (!options.baseFetch) {
      throw noBaseFetchError(request.url);
    }

    return options.baseFetch(input, init);
  };
}

export function installFetchInterceptor(
  config: NormalizedRuntimeInterceptConfig,
  logger: RuntimeLogger,
): () => void {
  const target = globalThis as { fetch?: FetchLike };
  const baseFetch = target.fetch;
  if (!baseFetch) {
    logger.debug("fetch.skip.no_base");
    return () => {
      logger.debug("fetch.restore.noop");
    };
  }

  const interceptedFetch = createInterceptedFetch({
    getSnapshot: () => ({
      mode: config.intercept.mode,
      routing: config.intercept.routing,
      mockResponses: config.intercept.mockResponses,
    }),
    logger,
    baseFetch,
  });

  target.fetch = interceptedFetch;
  logger.debug("fetch.installed");

  return () => {
    target.fetch = baseFetch;
    logger.debug("fetch.restored");
  };
}
