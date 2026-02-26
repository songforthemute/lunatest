import { installEthereumInterceptor } from "./interceptors/ethereum.js";
import { installFetchInterceptor } from "./interceptors/fetch.js";
import { installWebSocketInterceptor } from "./interceptors/websocket.js";
import { installXhrInterceptor } from "./interceptors/xhr.js";
import { createLogger } from "./logger.js";
import { getGlobalNodeEnv } from "./matcher.js";
import { getActiveRuntimeHandle, setActiveRuntimeHandle } from "./state.js";
import type {
  LunaRuntimeInterceptConfig,
  NormalizedRuntimeInterceptConfig,
  RouteMock,
  RuntimeInterceptHandle,
  RoutingConfig,
  RoutingMode,
} from "./types.js";

const DEFAULT_ROUTING_MODE = "strict";
const DEFAULT_BYPASS_WS_PATTERNS = ["*vite-hmr*", "*webpack-hmr*", "*next-hmr*"];

type MutableRuntimeHandle = RuntimeInterceptHandle & {
  setRouteMocks: (routes: RouteMock[]) => RouteMock[];
  applyInterceptState: (partialState: Record<string, unknown>) => Record<string, unknown>;
  getInterceptState: () => Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneRecord(input: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(input));
}

function mergeRecord(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(patch)) {
    const baseValue = next[key];
    if (isRecord(baseValue) && isRecord(value)) {
      next[key] = mergeRecord(baseValue, value);
      continue;
    }

    next[key] = value;
  }

  return next;
}

function normalizeRouteMocks(routes: RouteMock[]): RouteMock[] {
  return routes.map((route) => {
    if (route.endpointType === "ethereum") {
      return {
        endpointType: "ethereum",
        method: route.method,
        responseKey: route.responseKey,
      };
    }

    if (route.endpointType === "rpc") {
      return {
        endpointType: "rpc",
        urlPattern: route.urlPattern,
        methods: route.methods ? [...route.methods] : undefined,
        responseKey: route.responseKey,
      };
    }

    if (route.endpointType === "http") {
      return {
        endpointType: "http",
        urlPattern: route.urlPattern,
        method: route.method,
        responseKey: route.responseKey,
      };
    }

    return {
      endpointType: "ws",
      urlPattern: route.urlPattern,
      responseKey: route.responseKey,
      match: route.match,
    };
  });
}

function isRouteMock(route: unknown): route is RouteMock {
  if (!isRecord(route) || typeof route.endpointType !== "string") {
    return false;
  }

  if (typeof route.responseKey !== "string" || route.responseKey.length === 0) {
    return false;
  }

  if (route.endpointType === "ethereum") {
    return typeof route.method === "string" && route.method.length > 0;
  }

  if (route.endpointType === "rpc" || route.endpointType === "http" || route.endpointType === "ws") {
    return "urlPattern" in route;
  }

  return false;
}

function routeMocksToRouting(
  current: NormalizedRuntimeInterceptConfig["intercept"]["routing"],
  routes: RouteMock[],
): void {
  const ethereumMethods: NormalizedRuntimeInterceptConfig["intercept"]["routing"]["ethereumMethods"] = [];
  const rpcEndpoints: NormalizedRuntimeInterceptConfig["intercept"]["routing"]["rpcEndpoints"] = [];
  const httpEndpoints: NormalizedRuntimeInterceptConfig["intercept"]["routing"]["httpEndpoints"] = [];
  const wsEndpoints: NormalizedRuntimeInterceptConfig["intercept"]["routing"]["wsEndpoints"] = [];

  for (const route of routes) {
    if (route.endpointType === "ethereum") {
      ethereumMethods.push({
        method: route.method,
        responseKey: route.responseKey,
      });
      continue;
    }

    if (route.endpointType === "rpc") {
      rpcEndpoints.push({
        urlPattern: route.urlPattern,
        methods: route.methods ? [...route.methods] : undefined,
        responseKey: route.responseKey,
      });
      continue;
    }

    if (route.endpointType === "http") {
      httpEndpoints.push({
        urlPattern: route.urlPattern,
        method: route.method,
        responseKey: route.responseKey,
      });
      continue;
    }

    wsEndpoints.push({
      urlPattern: route.urlPattern,
      responseKey: route.responseKey,
      match: route.match,
    });
  }

  current.ethereumMethods = ethereumMethods;
  current.rpcEndpoints = rpcEndpoints;
  current.httpEndpoints = httpEndpoints;
  current.wsEndpoints = wsEndpoints;
}

function routingToRouteMocks(
  routing: NormalizedRuntimeInterceptConfig["intercept"]["routing"],
): RouteMock[] {
  const routes: RouteMock[] = [];

  for (const route of routing.ethereumMethods) {
    routes.push({
      endpointType: "ethereum",
      method: route.method,
      responseKey: route.responseKey,
    });
  }

  for (const route of routing.rpcEndpoints) {
    routes.push({
      endpointType: "rpc",
      urlPattern: route.urlPattern,
      methods: route.methods ? [...route.methods] : undefined,
      responseKey: route.responseKey,
    });
  }

  for (const route of routing.httpEndpoints) {
    routes.push({
      endpointType: "http",
      urlPattern: route.urlPattern,
      method: route.method,
      responseKey: route.responseKey,
    });
  }

  for (const route of routing.wsEndpoints) {
    routes.push({
      endpointType: "ws",
      urlPattern: route.urlPattern,
      responseKey: route.responseKey,
      match: route.match,
    });
  }

  return routes;
}

function normalizeRoutingPatch(
  routing: RoutingConfig | Record<string, unknown>,
  baseBypassWsPatterns: NormalizedRuntimeInterceptConfig["intercept"]["routing"]["bypassWsPatterns"],
): NormalizedRuntimeInterceptConfig["intercept"]["routing"] {
  return {
    ethereumMethods: Array.isArray(routing.ethereumMethods)
      ? [...routing.ethereumMethods]
      : [],
    rpcEndpoints: Array.isArray(routing.rpcEndpoints) ? [...routing.rpcEndpoints] : [],
    httpEndpoints: Array.isArray(routing.httpEndpoints) ? [...routing.httpEndpoints] : [],
    wsEndpoints: Array.isArray(routing.wsEndpoints) ? [...routing.wsEndpoints] : [],
    bypassWsPatterns: Array.isArray(routing.bypassWsPatterns)
      ? [...baseBypassWsPatterns, ...routing.bypassWsPatterns]
      : [...baseBypassWsPatterns],
  };
}

function requireActiveHandle(): MutableRuntimeHandle {
  const active = getActiveRuntimeHandle();
  if (!active) {
    throw new Error("Luna runtime intercept is not enabled");
  }

  const normalized = active as MutableRuntimeHandle;
  if (
    typeof normalized.setRouteMocks !== "function" ||
    typeof normalized.applyInterceptState !== "function" ||
    typeof normalized.getInterceptState !== "function"
  ) {
    throw new Error("Luna runtime intercept does not support mutable runtime APIs");
  }

  return normalized;
}

export function resolveEnabled(config: { enable?: boolean }, nodeEnv?: string): boolean {
  if (typeof config.enable === "boolean") {
    return config.enable;
  }

  return (nodeEnv ?? getGlobalNodeEnv()) === "development";
}

export function normalizeRuntimeInterceptConfig(
  input: LunaRuntimeInterceptConfig = {},
): NormalizedRuntimeInterceptConfig {
  const routing = input.intercept?.routing;
  const normalized: NormalizedRuntimeInterceptConfig = {
    enable: input.enable,
    debug: input.debug ?? false,
    intercept: {
      mode: input.intercept?.mode ?? DEFAULT_ROUTING_MODE,
      routing: {
        ethereumMethods: routing?.ethereumMethods ? [...routing.ethereumMethods] : [],
        rpcEndpoints: routing?.rpcEndpoints ? [...routing.rpcEndpoints] : [],
        httpEndpoints: routing?.httpEndpoints ? [...routing.httpEndpoints] : [],
        wsEndpoints: routing?.wsEndpoints ? [...routing.wsEndpoints] : [],
        bypassWsPatterns: [
          ...DEFAULT_BYPASS_WS_PATTERNS,
          ...(routing?.bypassWsPatterns ? [...routing.bypassWsPatterns] : []),
        ],
      },
      mockResponses: input.intercept?.mockResponses ? { ...input.intercept.mockResponses } : {},
    },
  };

  if (input.intercept?.routes && input.intercept.routes.length > 0) {
    routeMocksToRouting(normalized.intercept.routing, normalizeRouteMocks(input.intercept.routes));
  }

  return normalized;
}

export function createLunaRuntimeIntercept(config: LunaRuntimeInterceptConfig = {}): RuntimeInterceptHandle {
  const normalizedConfig = normalizeRuntimeInterceptConfig(config);
  const logger = createLogger(normalizedConfig.debug);
  let enabled = false;
  let restorers: Array<() => void> = [];
  let runtimeState: Record<string, unknown> = {};

  const setRouteMocksInternal = (routes: RouteMock[]): RouteMock[] => {
    if (!routes.every((route) => isRouteMock(route))) {
      throw new Error("Invalid route mock payload");
    }

    const normalized = normalizeRouteMocks(routes);
    routeMocksToRouting(normalizedConfig.intercept.routing, normalized);
    return routingToRouteMocks(normalizedConfig.intercept.routing);
  };

  return {
    enable(nodeEnv) {
      if (enabled) {
        return true;
      }

      const shouldEnable = resolveEnabled(normalizedConfig, nodeEnv);
      if (!shouldEnable) {
        logger.debug("runtime.skip", {
          nodeEnv: nodeEnv ?? getGlobalNodeEnv(),
        });
        return false;
      }

      try {
        restorers = [
          installEthereumInterceptor(normalizedConfig, logger),
          installFetchInterceptor(normalizedConfig, logger),
          installXhrInterceptor(normalizedConfig, logger),
          installWebSocketInterceptor(normalizedConfig, logger),
        ];
      } catch (error) {
        for (const restore of restorers.reverse()) {
          restore();
        }
        restorers = [];
        throw error;
      }

      enabled = true;
      logger.debug("runtime.enabled", {
        mode: normalizedConfig.intercept.mode,
      });

      return true;
    },
    disable() {
      if (!enabled) {
        return;
      }

      for (const restore of restorers.reverse()) {
        restore();
      }
      restorers = [];
      enabled = false;
      logger.debug("runtime.disabled");
    },
    isEnabled() {
      return enabled;
    },
    setRouteMocks(routes) {
      return setRouteMocksInternal(routes);
    },
    applyInterceptState(partialState) {
      runtimeState = mergeRecord(runtimeState, partialState);

      const mode = runtimeState.mode;
      if (mode === "strict" || mode === "permissive") {
        normalizedConfig.intercept.mode = mode as RoutingMode;
      }

      const mockResponses = runtimeState.mockResponses;
      if (isRecord(mockResponses)) {
        normalizedConfig.intercept.mockResponses = {
          ...normalizedConfig.intercept.mockResponses,
          ...mockResponses,
        };
      }

      const routing = runtimeState.routing;
      if (isRecord(routing)) {
        normalizedConfig.intercept.routing = normalizeRoutingPatch(
          routing,
          normalizedConfig.intercept.routing.bypassWsPatterns,
        );
      }

      const routes = runtimeState.routes;
      if (Array.isArray(routes)) {
        const routeCandidates = routes.filter((route): route is RouteMock => isRouteMock(route));
        if (routeCandidates.length === routes.length) {
          setRouteMocksInternal(routeCandidates);
        }
      }

      return cloneRecord(runtimeState);
    },
    getInterceptState() {
      return cloneRecord(runtimeState);
    },
  };
}

export function enableLunaRuntimeIntercept(
  config: LunaRuntimeInterceptConfig = {},
  nodeEnv?: string,
): boolean {
  const active = getActiveRuntimeHandle();
  if (active && active.isEnabled()) {
    return true;
  }

  if (active && !active.isEnabled()) {
    setActiveRuntimeHandle(null);
  }

  const handle = createLunaRuntimeIntercept(config);
  setActiveRuntimeHandle(handle);
  return handle.enable(nodeEnv);
}

export function disableLunaRuntimeIntercept(): void {
  const active = getActiveRuntimeHandle();
  if (!active) {
    return;
  }

  active.disable();
  setActiveRuntimeHandle(null);
}

export function isLunaRuntimeInterceptEnabled(): boolean {
  const active = getActiveRuntimeHandle();
  return active?.isEnabled() ?? false;
}

export function setRouteMocks(routes: RouteMock[]): RouteMock[] {
  return requireActiveHandle().setRouteMocks(routes);
}

export function applyInterceptState(partialState: Record<string, unknown>): Record<string, unknown> {
  return requireActiveHandle().applyInterceptState(partialState);
}

export function getInterceptState(): Record<string, unknown> {
  return requireActiveHandle().getInterceptState();
}
