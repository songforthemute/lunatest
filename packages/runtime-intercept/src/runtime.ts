import { installEthereumInterceptor } from "./interceptors/ethereum.js";
import { installFetchInterceptor } from "./interceptors/fetch.js";
import { installWebSocketInterceptor } from "./interceptors/websocket.js";
import { installXhrInterceptor } from "./interceptors/xhr.js";
import { createLogger } from "./logger.js";
import { getGlobalNodeEnv } from "./matcher.js";
import { getActiveRuntimeHandle, setActiveRuntimeHandle } from "./state.js";
import { deepClone, deepMerge, isRecord } from "@lunatest/contracts";
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
  appendRouteMocks: (routes: RouteMock[]) => RouteMock[];
  applyInterceptState: (partialState: Record<string, unknown>) => Record<string, unknown>;
  getInterceptState: () => Record<string, unknown>;
};

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
  current: NormalizedRuntimeInterceptConfig["intercept"]["routing"],
  routing: RoutingConfig | Record<string, unknown>,
): void {
  if (Array.isArray(routing.ethereumMethods)) {
    current.ethereumMethods = [...routing.ethereumMethods];
  }
  if (Array.isArray(routing.rpcEndpoints)) {
    current.rpcEndpoints = [...routing.rpcEndpoints];
  }
  if (Array.isArray(routing.httpEndpoints)) {
    current.httpEndpoints = [...routing.httpEndpoints];
  }
  if (Array.isArray(routing.wsEndpoints)) {
    current.wsEndpoints = [...routing.wsEndpoints];
  }
  if (Array.isArray(routing.bypassWsPatterns)) {
    const merged = [...current.bypassWsPatterns, ...routing.bypassWsPatterns];
    current.bypassWsPatterns = Array.from(new Set(merged));
  }
}

function requireActiveHandle(): MutableRuntimeHandle {
  const active = getActiveRuntimeHandle();
  if (!active) {
    throw new Error("Luna runtime intercept is not enabled");
  }

  const normalized = active as MutableRuntimeHandle;
  if (
    typeof normalized.setRouteMocks !== "function" ||
    typeof normalized.appendRouteMocks !== "function" ||
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

  const appendRouteMocksInternal = (routes: RouteMock[]): RouteMock[] => {
    if (!routes.every((route) => isRouteMock(route))) {
      throw new Error("Invalid route mock payload");
    }

    const next = [
      ...routingToRouteMocks(normalizedConfig.intercept.routing),
      ...normalizeRouteMocks(routes),
    ];

    routeMocksToRouting(normalizedConfig.intercept.routing, next);
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
    appendRouteMocks(routes) {
      return appendRouteMocksInternal(routes);
    },
    applyInterceptState(partialState) {
      runtimeState = deepMerge(runtimeState, partialState);

      const mode = partialState.mode;
      if (mode === "strict" || mode === "permissive") {
        normalizedConfig.intercept.mode = mode as RoutingMode;
      }

      const mockResponses = partialState.mockResponses;
      if (isRecord(mockResponses)) {
        normalizedConfig.intercept.mockResponses = deepMerge(
          normalizedConfig.intercept.mockResponses,
          mockResponses,
        );
      }

      const routing = partialState.routing;
      if (isRecord(routing)) {
        normalizeRoutingPatch(
          normalizedConfig.intercept.routing,
          routing,
        );
      }

      const routes = partialState.routes;
      if (Array.isArray(routes)) {
        const routeCandidates = routes.filter((route): route is RouteMock => isRouteMock(route));
        if (routeCandidates.length === routes.length) {
          setRouteMocksInternal(routeCandidates);
        }
      }

      return deepClone(runtimeState);
    },
    getInterceptState() {
      return deepClone(runtimeState);
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

export function appendRouteMocks(routes: RouteMock[]): RouteMock[] {
  return requireActiveHandle().appendRouteMocks(routes);
}

export function applyInterceptState(partialState: Record<string, unknown>): Record<string, unknown> {
  return requireActiveHandle().applyInterceptState(partialState);
}

export function getInterceptState(): Record<string, unknown> {
  return requireActiveHandle().getInterceptState();
}
