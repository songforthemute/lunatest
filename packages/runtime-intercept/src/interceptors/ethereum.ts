import { extractPermissionKeys, normalizeWalletPermissions, type LunaWalletSession } from "@lunatest/contracts";
import { isRecord, resolveMock } from "../matcher.js";
import type { RuntimeLogger } from "../logger.js";
import type { NormalizedRuntimeInterceptConfig } from "../types.js";

type EthereumListener = (...args: unknown[]) => void;

type EthereumLike = {
  request?: (payload: { method?: unknown; params?: unknown }) => Promise<unknown>;
  on?: (event: string, listener: EthereumListener) => unknown;
  removeListener?: (event: string, listener: EthereumListener) => unknown;
};

type WalletSessionController = {
  getWalletSession: () => LunaWalletSession;
  setWalletSession: (session: Partial<LunaWalletSession>) => LunaWalletSession;
};

type MockReceipt = {
  transactionHash: string;
  status: "0x1" | "0x0";
  blockNumber: string;
};

const DEFAULT_GAS_PRICE = 30_000_000_000n;
const DEFAULT_ESTIMATE_GAS = 150_000n;

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
  walletController: WalletSessionController = {
    getWalletSession: () => ({
      enabled: false,
      connected: false,
      chainId: "0x1",
      accounts: [],
      permissions: [],
      assets: {
        nativeBalance: "0",
        tokens: {},
      },
    }),
    setWalletSession: () => ({
      enabled: false,
      connected: false,
      chainId: "0x1",
      accounts: [],
      permissions: [],
      assets: {
        nativeBalance: "0",
        tokens: {},
      },
    }),
  },
): () => void {
  const target = globalThis as unknown as { window?: Record<string, unknown> };
  const createdSyntheticWindow = !target.window;
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
  const receipts = new Map<string, MockReceipt | null>();
  const nonces = new Map<string, number>();
  let txCounter = 1n;
  let blockNumber = 1n;

  const emitLocal = (event: string, ...args: unknown[]): void => {
    const bucket = listeners.get(event);
    if (!bucket) {
      return;
    }

    for (const listener of bucket) {
      listener(...args);
    }
  };

  const createTxHash = (): string => {
    const txHash = `0x${txCounter.toString(16).padStart(64, "0")}`;
    txCounter += 1n;
    return txHash;
  };

  const handleWalletRequest = async (
    method: string,
    payload: { method?: unknown; params?: unknown },
  ): Promise<unknown> => {
    const session = walletController.getWalletSession();
    if (!session.enabled) {
      return undefined;
    }

    if (method === "eth_chainId") {
      return session.chainId;
    }

    if (method === "eth_accounts") {
      const hasPermission = session.permissions.some(
        (permission) => permission.parentCapability === "eth_accounts",
      );

      return session.connected && hasPermission ? [...session.accounts] : [];
    }

    if (method === "eth_requestAccounts") {
      const next = walletController.setWalletSession({
        connected: true,
        permissions: normalizeWalletPermissions([...session.permissions, "eth_accounts"]),
      });
      emitLocal("accountsChanged", [...next.accounts]);
      emitLocal("connect", { chainId: next.chainId });
      return [...next.accounts];
    }

    if (method === "wallet_requestPermissions") {
      const keys = extractPermissionKeys(Array.isArray(payload.params) ? payload.params : undefined);
      const next = walletController.setWalletSession({
        connected: keys.includes("eth_accounts") ? true : session.connected,
        permissions: normalizeWalletPermissions([...session.permissions, ...keys]),
      });

      if (keys.includes("eth_accounts")) {
        emitLocal("accountsChanged", [...next.accounts]);
      }

      return [...next.permissions];
    }

    if (method === "wallet_getPermissions") {
      return [...session.permissions];
    }

    if (method === "wallet_revokePermissions") {
      const keys = new Set(extractPermissionKeys(Array.isArray(payload.params) ? payload.params : undefined));
      const revoked = session.permissions.filter((permission) => keys.has(permission.parentCapability));
      const next = walletController.setWalletSession({
        connected: keys.has("eth_accounts") ? false : session.connected,
        permissions: session.permissions.filter(
          (permission) => !keys.has(permission.parentCapability),
        ),
      });

      if (keys.has("eth_accounts")) {
        emitLocal("accountsChanged", next.connected ? [...next.accounts] : []);
      }

      return revoked;
    }

    if (method === "wallet_switchEthereumChain") {
      const [target] = Array.isArray(payload.params) ? payload.params : [];
      const chainId =
        target && typeof target === "object"
          ? (target as { chainId?: unknown }).chainId
          : undefined;

      if (typeof chainId !== "string") {
        throw new Error("wallet_switchEthereumChain requires chainId");
      }

      const next = walletController.setWalletSession({ chainId });
      emitLocal("chainChanged", next.chainId);
      return null;
    }

    if (method === "eth_getTransactionCount") {
      const [address] = Array.isArray(payload.params) ? payload.params : [];
      const key =
        typeof address === "string" ? address.toLowerCase() : session.accounts[0]?.toLowerCase() ?? "default";
      const nonce = nonces.get(key) ?? 0;
      return `0x${nonce.toString(16)}`;
    }

    if (method === "eth_blockNumber") {
      return `0x${blockNumber.toString(16)}`;
    }

    if (method === "eth_gasPrice") {
      return `0x${DEFAULT_GAS_PRICE.toString(16)}`;
    }

    if (method === "eth_estimateGas") {
      return `0x${DEFAULT_ESTIMATE_GAS.toString(16)}`;
    }

    if (method === "eth_sendTransaction") {
      const txHash = createTxHash();
      const [request] = Array.isArray(payload.params) ? payload.params : [];
      const fromAddress =
        request && typeof request === "object" && typeof (request as { from?: unknown }).from === "string"
          ? ((request as { from: string }).from).toLowerCase()
          : session.accounts[0]?.toLowerCase() ?? "default";
      const nonce = nonces.get(fromAddress) ?? 0;

      nonces.set(fromAddress, nonce + 1);
      receipts.set(txHash, null);
      emitLocal("message", {
        type: "tx_submitted",
        data: { transactionHash: txHash },
      });

      setTimeout(() => {
        receipts.set(txHash, {
          transactionHash: txHash,
          status: "0x1",
          blockNumber: `0x${blockNumber.toString(16)}`,
        });
        blockNumber += 1n;
      }, 1200);

      return txHash;
    }

    if (method === "eth_getTransactionReceipt") {
      const [txHash] = Array.isArray(payload.params) ? payload.params : [];
      if (typeof txHash !== "string") {
        return null;
      }

      return receipts.get(txHash) ?? null;
    }

    return undefined;
  };

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

      const walletResult = await handleWalletRequest(method, payload);
      if (walletResult !== undefined) {
        logger.debug("ethereum.wallet", {
          method,
        });
        return walletResult;
      }

      if (config.intercept.mode === "strict") {
        logger.debug("ethereum.blocked.unmatched", { method });
        throw new Error(`Luna runtime intercept blocked unmatched ethereum request: ${method}`);
      }

      if (originalRequest) {
        logger.debug("ethereum.forward", { method });
        return originalRequest.call(originalEthereum, payload);
      }

      if (method === "eth_requestAccounts") {
        throw new Error(
          "No injected wallet available. Enable Luna Wallet in LunaTest Devtools or install a wallet extension.",
        );
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
    if (createdSyntheticWindow && originalEthereum === undefined) {
      delete target.window;
    } else if (originalEthereum === undefined) {
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
