import {
  createLunaWalletSession,
  extractPermissionKeys,
  normalizeAddress,
  normalizeWalletPermissions,
  type LunaWalletChain,
  type LunaWalletSession,
  type LunaWalletWatchedAsset,
} from "@lunatest/contracts";
import { isRecord, resolveMock } from "../matcher.js";
import type { RuntimeLogger } from "../logger.js";
import type { NormalizedRuntimeInterceptConfig } from "../types.js";
import { createProviderError } from "../provider-errors.js";
import { resolveProtocolRequest } from "../protocols/engine.js";

type EthereumListener = (...args: unknown[]) => void;

type EthereumLike = {
  request?: (payload: { method?: unknown; params?: unknown }) => Promise<unknown>;
  on?: (event: string, listener: EthereumListener) => unknown;
  removeListener?: (event: string, listener: EthereumListener) => unknown;
};

type WalletSessionController = {
  getWalletSession: () => LunaWalletSession;
  setWalletSession: (session: Partial<LunaWalletSession>) => LunaWalletSession;
  getRuntimeState?: () => Record<string, unknown>;
};

type MockReceipt = {
  transactionHash: string;
  status: "0x1" | "0x0";
  blockNumber: string;
};

const DEFAULT_GAS_PRICE = 30_000_000_000n;
const DEFAULT_ESTIMATE_GAS = 150_000n;
const DEFAULT_MAX_PRIORITY_FEE = 1_500_000_000n;
const ZERO_HASH = `0x${"0".repeat(64)}`;

function toError(value: unknown, fallbackMessage: string): Error {
  if (value instanceof Error) {
    return value;
  }

  if (isRecord(value) && typeof value.code === "number") {
    const message = typeof value.message === "string" ? value.message : fallbackMessage;
    if (
      value.code === 4001 ||
      value.code === 4100 ||
      value.code === 4200 ||
      value.code === 4900 ||
      value.code === 4901 ||
      value.code === 4902
    ) {
      return createProviderError(value.code, message, value.data);
    }
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

function normalizeHexQuantity(value: string | number | bigint): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^0x[0-9a-f]+$/i.test(trimmed)) {
      return trimmed.toLowerCase();
    }
    if (/^[0-9]+$/.test(trimmed)) {
      return `0x${BigInt(trimmed).toString(16)}`;
    }
    return "0x0";
  }

  return `0x${BigInt(value).toString(16)}`;
}

function parseQuantity(value: unknown, fallback: bigint): bigint {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return BigInt(Math.floor(value));
  }

  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  if (/^0x[0-9a-f]+$/i.test(trimmed)) {
    return BigInt(trimmed);
  }

  if (/^[0-9]+$/.test(trimmed)) {
    return BigInt(trimmed);
  }

  return fallback;
}

function normalizeChainId(value: unknown): string | null {
  if (typeof value !== "string" || !/^0x[0-9a-f]+$/i.test(value)) {
    return null;
  }

  return value.toLowerCase();
}

function chainIdToNetworkVersion(chainId: string): string {
  return parseQuantity(chainId, 1n).toString(10);
}

function deterministicHex(input: unknown, bytes: number): string {
  const source = typeof input === "string" ? input : JSON.stringify(input);
  let hash = 0x811c9dc5;
  let hex = "";

  for (let index = 0; hex.length < bytes * 2; index += 1) {
    const charCode = source.charCodeAt(index % Math.max(source.length, 1)) || index;
    hash ^= charCode + index;
    hash = Math.imul(hash, 0x01000193) >>> 0;
    hex += hash.toString(16).padStart(8, "0");
  }

  return `0x${hex.slice(0, bytes * 2)}`;
}

function isRejectedMethod(session: LunaWalletSession, method: string): boolean {
  return session.behavior?.userRejectedMethods?.includes(method) ?? false;
}

function isKnownChain(session: LunaWalletSession, chainId: string): boolean {
  return Boolean(session.knownChains?.[chainId]);
}

function isWalletScopedMethod(method: string): boolean {
  return method.startsWith("wallet_") || method === "personal_sign" || method.startsWith("eth_signTypedData");
}

function hasAccountPermission(session: LunaWalletSession): boolean {
  return session.permissions.some((permission) => permission.parentCapability === "eth_accounts");
}

function assertAccountAuthorized(session: LunaWalletSession, address: unknown, method: string): void {
  if (typeof address !== "string") {
    return;
  }

  const known = new Set(session.accounts.map((account) => account.toLowerCase()));
  if (!session.connected || !hasAccountPermission(session) || !known.has(address.toLowerCase())) {
    throw createProviderError(4100, `Luna wallet is not authorized for ${method}`);
  }
}

function normalizeAddEthereumChainParams(params: unknown): LunaWalletChain | null {
  const candidate = Array.isArray(params) ? params[0] : params;
  if (!isRecord(candidate)) {
    return null;
  }

  const chainId = normalizeChainId(candidate.chainId);
  if (!chainId) {
    return null;
  }

  return {
    chainId,
    chainName: typeof candidate.chainName === "string" ? candidate.chainName : undefined,
    rpcUrls: Array.isArray(candidate.rpcUrls)
      ? candidate.rpcUrls.filter((url): url is string => typeof url === "string")
      : undefined,
    blockExplorerUrls: Array.isArray(candidate.blockExplorerUrls)
      ? candidate.blockExplorerUrls.filter((url): url is string => typeof url === "string")
      : undefined,
    nativeCurrency: isRecord(candidate.nativeCurrency)
      ? {
          name: typeof candidate.nativeCurrency.name === "string" ? candidate.nativeCurrency.name : undefined,
          symbol: typeof candidate.nativeCurrency.symbol === "string" ? candidate.nativeCurrency.symbol : undefined,
          decimals: typeof candidate.nativeCurrency.decimals === "number" ? candidate.nativeCurrency.decimals : undefined,
        }
      : undefined,
  };
}

function normalizeWatchAssetParams(params: unknown): LunaWalletWatchedAsset | null {
  const candidate = Array.isArray(params) ? params[0] : params;
  if (!isRecord(candidate) || typeof candidate.type !== "string" || !isRecord(candidate.options)) {
    return null;
  }

  return {
    type: candidate.type,
    options: { ...candidate.options },
  };
}

function createBlock(blockNumber: bigint, includeTransactions: boolean): Record<string, unknown> {
  const number = normalizeHexQuantity(blockNumber);

  return {
    number,
    hash: deterministicHex(`block:${number}`, 32),
    parentHash: blockNumber > 0n ? deterministicHex(`block:${blockNumber - 1n}`, 32) : ZERO_HASH,
    nonce: "0x0000000000000000",
    sha3Uncles: ZERO_HASH,
    logsBloom: `0x${"0".repeat(512)}`,
    transactionsRoot: deterministicHex(`txroot:${number}`, 32),
    stateRoot: deterministicHex(`stateroot:${number}`, 32),
    receiptsRoot: deterministicHex(`receiptsroot:${number}`, 32),
    miner: "0x0000000000000000000000000000000000000000",
    difficulty: "0x0",
    totalDifficulty: "0x0",
    extraData: "0x",
    size: "0x0",
    gasLimit: "0x1c9c380",
    gasUsed: "0x0",
    timestamp: normalizeHexQuantity(1_700_000_000n + blockNumber),
    transactions: includeTransactions ? [] : [],
    baseFeePerGas: normalizeHexQuantity(DEFAULT_GAS_PRICE),
  };
}

export function installEthereumInterceptor(
  config: NormalizedRuntimeInterceptConfig,
  logger: RuntimeLogger,
  walletController: WalletSessionController = {
    getWalletSession: () => createLunaWalletSession(),
    setWalletSession: () => createLunaWalletSession(),
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

    if (isRejectedMethod(session, method)) {
      throw createProviderError(4001, `Luna wallet rejected ${method}`);
    }

    if (method === "eth_chainId") {
      return session.chainId;
    }

    if (method === "net_version") {
      return chainIdToNetworkVersion(session.chainId);
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
      const chainId = normalizeChainId(
        target && typeof target === "object"
          ? (target as { chainId?: unknown }).chainId
          : undefined,
      );

      if (!chainId) {
        throw new Error("wallet_switchEthereumChain requires chainId");
      }

      if (!isKnownChain(session, chainId)) {
        throw createProviderError(4902, `Luna wallet does not know chain ${chainId}`);
      }

      const next = walletController.setWalletSession({ chainId });
      emitLocal("chainChanged", next.chainId);
      return null;
    }

    if (method === "wallet_addEthereumChain") {
      const chain = normalizeAddEthereumChainParams(payload.params);
      if (!chain) {
        throw new Error("wallet_addEthereumChain requires chain metadata with chainId");
      }

      walletController.setWalletSession({
        knownChains: {
          ...(session.knownChains ?? {}),
          [chain.chainId]: chain,
        },
      });
      return null;
    }

    if (method === "wallet_watchAsset") {
      const asset = normalizeWatchAssetParams(payload.params);
      if (!asset) {
        throw new Error("wallet_watchAsset requires an asset descriptor");
      }

      const tokens = { ...session.assets.tokens };
      if (
        asset.type.toUpperCase() === "ERC20" &&
        typeof asset.options.address === "string"
      ) {
        const tokenAddress = normalizeAddress(asset.options.address);
        tokens[tokenAddress] = {
          ...tokens[tokenAddress],
          balance: tokens[tokenAddress]?.balance ?? "0",
          allowance: tokens[tokenAddress]?.allowance ?? "0",
          symbol: typeof asset.options.symbol === "string" ? asset.options.symbol : tokens[tokenAddress]?.symbol,
          decimals:
            typeof asset.options.decimals === "number" ? asset.options.decimals : tokens[tokenAddress]?.decimals,
        };
      }

      walletController.setWalletSession({
        watchedAssets: [...(session.watchedAssets ?? []), asset],
        assets: {
          ...session.assets,
          tokens,
        },
      });
      return true;
    }

    if (method === "eth_getBalance") {
      const [address] = Array.isArray(payload.params) ? payload.params : [];
      const knownAccounts = new Set(session.accounts.map((account) => account.toLowerCase()));
      if (typeof address === "string" && !knownAccounts.has(address.toLowerCase())) {
        return "0x0";
      }

      return normalizeHexQuantity(session.assets.nativeBalance);
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

    if (method === "eth_maxPriorityFeePerGas") {
      return normalizeHexQuantity(DEFAULT_MAX_PRIORITY_FEE);
    }

    if (method === "eth_estimateGas") {
      return `0x${DEFAULT_ESTIMATE_GAS.toString(16)}`;
    }

    if (method === "eth_feeHistory") {
      const params = Array.isArray(payload.params) ? payload.params : [];
      const blockCount = Number(parseQuantity(params[0], 1n));
      const safeBlockCount = Math.max(1, Math.min(blockCount, 1024));
      const rewardPercentiles = Array.isArray(params[2]) ? params[2] : [];

      return {
        oldestBlock: normalizeHexQuantity(blockNumber > BigInt(safeBlockCount) ? blockNumber - BigInt(safeBlockCount) : 0n),
        baseFeePerGas: Array.from({ length: safeBlockCount + 1 }, (_, index) =>
          normalizeHexQuantity(DEFAULT_GAS_PRICE + BigInt(index) * 1_000_000n),
        ),
        gasUsedRatio: Array.from({ length: safeBlockCount }, () => 0.5),
        reward: Array.from({ length: safeBlockCount }, () =>
          rewardPercentiles.map(() => normalizeHexQuantity(DEFAULT_MAX_PRIORITY_FEE)),
        ),
      };
    }

    if (method === "eth_getBlockByNumber") {
      const params = Array.isArray(payload.params) ? payload.params : [];
      const tag = params[0];
      const includeTransactions = params[1] === true;
      const resolvedBlockNumber =
        tag === "latest" || tag === "pending" || tag === undefined
          ? blockNumber
          : tag === "earliest"
            ? 0n
            : parseQuantity(tag, blockNumber);

      return createBlock(resolvedBlockNumber, includeTransactions);
    }

    if (method === "eth_sendTransaction") {
      const txHash = createTxHash();
      const [request] = Array.isArray(payload.params) ? payload.params : [];
      const fromAddress =
        request && typeof request === "object" && typeof (request as { from?: unknown }).from === "string"
          ? ((request as { from: string }).from).toLowerCase()
          : session.accounts[0]?.toLowerCase() ?? "default";

      assertAccountAuthorized(session, fromAddress, method);
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

    if (method === "personal_sign") {
      const params = Array.isArray(payload.params) ? payload.params : [];
      const message = params[0];
      const address = params[1];
      assertAccountAuthorized(session, address, method);
      return deterministicHex({ method, message, address, chainId: session.chainId }, 65);
    }

    if (method === "eth_signTypedData_v4") {
      const params = Array.isArray(payload.params) ? payload.params : [];
      const address = params[0];
      const typedData = params[1];
      assertAccountAuthorized(session, address, method);
      return deterministicHex({ method, typedData, address, chainId: session.chainId }, 65);
    }

    if (isWalletScopedMethod(method)) {
      throw createProviderError(4200, `Luna wallet does not support ${method}`);
    }

    return undefined;
  };

  const tryProtocolRequest = (
    method: string,
    payload: { method?: unknown; params?: unknown },
  ): { handled: true; result: unknown } | { handled: false } => {
    const session = walletController.getWalletSession();
    if (!session.enabled) {
      return { handled: false };
    }

    return resolveProtocolRequest({
      method,
      params: payload.params,
      runtimeState: walletController.getRuntimeState?.() ?? {},
      walletSession: session,
      setWalletSession: walletController.setWalletSession,
    });
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
          const protocolResult = tryProtocolRequest(method, payload);
          if (protocolResult.handled) {
            logger.debug("ethereum.protocol", {
              method,
              key: route.responseKey,
            });
            return protocolResult.result;
          }

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

      const protocolResult = tryProtocolRequest(method, payload);
      if (protocolResult.handled) {
        logger.debug("ethereum.protocol", {
          method,
        });
        return protocolResult.result;
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
