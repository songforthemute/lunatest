import { isRecord, resolveMock } from "../matcher";
import type { RuntimeLogger } from "../logger";
import type { NormalizedRuntimeInterceptConfig } from "../types";

type EthereumListener = (...args: unknown[]) => void;

type EthereumLike = {
  request?: (payload: { method?: unknown; params?: unknown }) => Promise<unknown>;
  on?: (event: string, listener: EthereumListener) => unknown;
  removeListener?: (event: string, listener: EthereumListener) => unknown;
};

function toError(value: unknown, fallbackMessage: string): Error {
  if (value instanceof Error) {
    return value;
  }

  if (typeof value === "string") {
    return new Error(value);
  }

  return new Error(fallbackMessage);
}

function extractMockResult(value: unknown): unknown {
  if (isRecord(value) && "error" in value) {
    throw toError((value as { error?: unknown }).error, "Luna runtime intercept ethereum error");
  }

  if (isRecord(value) && "result" in value) {
    return (value as { result?: unknown }).result;
  }

  return value;
}

export function installEthereumInterceptor(
  config: NormalizedRuntimeInterceptConfig,
  logger: RuntimeLogger,
): () => void {
  const target = globalThis as unknown as { window?: Record<string, unknown> };
  if (!target.window) {
    target.window = globalThis as unknown as Record<string, unknown>;
  }

  const win = target.window as {
    ethereum?: unknown;
  };

  const originalEthereum = win.ethereum as EthereumLike | undefined;
  const originalRequest = typeof originalEthereum?.request === "function" ? originalEthereum.request : undefined;
  const originalOn = typeof originalEthereum?.on === "function" ? originalEthereum.on : undefined;
  const originalRemoveListener =
    typeof originalEthereum?.removeListener === "function"
      ? originalEthereum.removeListener
      : undefined;

  const listeners = new Map<string, Set<EthereumListener>>();

  const api: EthereumLike & { isLunaTest: boolean } = {
    isLunaTest: true,
    async request(payload) {
      const method = typeof payload?.method === "string" ? payload.method : "unknown";
      const route = config.intercept.routing.ethereumMethods.find((item) => item.method === method);

      if (route) {
        const response = await resolveMock(config.intercept.mockResponses[route.responseKey], {
          url: "window.ethereum",
          method,
          payload,
          endpointType: "ethereum",
        });

        if (response === undefined) {
          if (config.intercept.mode === "strict") {
            logger.debug("ethereum.blocked.no_response", {
              method,
              key: route.responseKey,
            });
            throw new Error(`Luna runtime intercept blocked ethereum request: ${method}`);
          }

          if (originalRequest) {
            return originalRequest.call(originalEthereum, payload);
          }

          throw new Error(`Luna runtime intercept ethereum has no response: ${method}`);
        }

        logger.debug("ethereum.hit", {
          method,
          key: route.responseKey,
        });

        return extractMockResult(response);
      }

      if (config.intercept.mode === "strict") {
        logger.debug("ethereum.blocked.unmatched", { method });
        throw new Error(`Luna runtime intercept blocked unmatched ethereum request: ${method}`);
      }

      if (originalRequest) {
        logger.debug("ethereum.forward", { method });
        return originalRequest.call(originalEthereum, payload);
      }

      throw new Error(`Luna runtime intercept ethereum provider has no handler for ${method}`);
    },
    on(event, listener) {
      const bucket = listeners.get(event) ?? new Set<EthereumListener>();
      bucket.add(listener);
      listeners.set(event, bucket);
      if (originalOn) {
        originalOn.call(originalEthereum, event, listener);
      }
      return api;
    },
    removeListener(event, listener) {
      const bucket = listeners.get(event);
      if (bucket) {
        bucket.delete(listener);
        if (bucket.size === 0) {
          listeners.delete(event);
        }
      }

      if (originalRemoveListener) {
        originalRemoveListener.call(originalEthereum, event, listener);
      }

      return api;
    },
  };

  Object.defineProperty(win, "ethereum", {
    configurable: true,
    writable: true,
    value: api,
  });

  logger.debug("ethereum.installed");

  return () => {
    if (originalEthereum === undefined) {
      delete (win as Record<string, unknown>).ethereum;
    } else {
      Object.defineProperty(win, "ethereum", {
        configurable: true,
        writable: true,
        value: originalEthereum,
      });
    }

    logger.debug("ethereum.restored");
  };
}
