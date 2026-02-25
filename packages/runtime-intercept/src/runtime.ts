import { installEthereumInterceptor } from "./interceptors/ethereum";
import { installFetchInterceptor } from "./interceptors/fetch";
import { installWebSocketInterceptor } from "./interceptors/websocket";
import { installXhrInterceptor } from "./interceptors/xhr";
import { createLogger } from "./logger";
import { getGlobalNodeEnv } from "./matcher";
import { getActiveRuntimeHandle, setActiveRuntimeHandle } from "./state";
import type {
  LunaRuntimeInterceptConfig,
  NormalizedRuntimeInterceptConfig,
  RuntimeInterceptHandle,
} from "./types";

const DEFAULT_ROUTING_MODE = "strict";
const DEFAULT_BYPASS_WS_PATTERNS = ["*vite-hmr*", "*webpack-hmr*", "*next-hmr*"];

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

  return {
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
}

export function createLunaRuntimeIntercept(config: LunaRuntimeInterceptConfig = {}): RuntimeInterceptHandle {
  const normalizedConfig = normalizeRuntimeInterceptConfig(config);
  const logger = createLogger(normalizedConfig.debug);
  let enabled = false;
  let restorers: Array<() => void> = [];

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
