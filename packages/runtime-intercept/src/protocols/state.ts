import type { LunaWalletSession } from "@lunatest/contracts";
import { hexQuantity } from "./hex.js";

export type ProtocolRuntimeToken = {
  symbol?: string;
  decimals?: number;
  balances?: Record<string, string>;
  allowances?: Record<string, Record<string, string>>;
};

export type ProtocolReceipt = {
  transactionHash: string;
  status: "0x1" | "0x0";
  blockNumber: string;
  logs: unknown[];
};

export type ProtocolRuntimeState = {
  activeProtocol?: "uniswap_v2" | "uniswap_v3" | "curve" | "aave" | string;
  supportLevel?: "L3" | string;
  chainId?: number;
  contracts?: Record<string, string>;
  tokens?: Record<string, ProtocolRuntimeToken>;
  transactionBehavior?: {
    confirmationDelayMs?: number;
    forcePending?: boolean;
    forceRevert?: boolean;
    userRejectedMethods?: string[];
  };
  receipts?: Record<string, ProtocolReceipt | null>;
  nextTxId?: number;
  uniswapV2?: {
    router: string;
    factory?: string;
    pairs?: Array<{
      address?: string;
      token0: string;
      token1: string;
      reserve0: string;
      reserve1: string;
    }>;
  };
  uniswapV3?: {
    router: string;
    quoter?: string;
    quoterVersion?: "v1" | "v2" | string;
    pools?: Array<{
      address?: string;
      token0: string;
      token1: string;
      fee: number;
      priceNumerator: string;
      priceDenominator: string;
      liquidity?: string;
    }>;
  };
  curve?: {
    router: string;
    pools?: Array<{
      name: string;
      address?: string;
      coins: string[];
      balances: string[];
      feeBps?: number;
      virtualPrice?: string;
    }>;
  };
  aave?: {
    pool: string;
    oracle: string;
    reserves?: Array<{
      asset: string;
      symbol: string;
      price: string;
      ltvBps: number;
      liquidationThresholdBps: number;
    }>;
    positions?: Record<string, {
      collateral?: Record<string, string>;
      debt?: Record<string, string>;
    }>;
  };
};

export type ProtocolResolution =
  | { handled: true; result: unknown }
  | { handled: false };

export type ProtocolResolverInput = {
  method: string;
  params: unknown;
  runtimeState: Record<string, unknown>;
  walletSession: LunaWalletSession;
  setWalletSession: (session: Partial<LunaWalletSession>) => LunaWalletSession;
  now?: () => number;
};

export type ProtocolCallInput = ProtocolResolverInput & {
  to: string;
  data: string;
  protocolRuntime: ProtocolRuntimeState;
};

export type ProtocolTransactionInput = ProtocolCallInput & {
  from?: string;
};

export type ProtocolTransactionEffect =
  | { handled: true; status?: "0x1" | "0x0" }
  | { handled: false };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function getProtocolRuntimeState(runtimeState: Record<string, unknown>): ProtocolRuntimeState | null {
  const candidate = runtimeState.protocolRuntime;
  if (!isRecord(candidate)) {
    return null;
  }

  return candidate as ProtocolRuntimeState;
}

export function normalizeAddress(value: string): string {
  return value.toLowerCase();
}

export function getTransactionRequest(params: unknown): Record<string, unknown> | null {
  const [request] = Array.isArray(params) ? params : [];
  return isRecord(request) ? request : null;
}

export function getCallRequest(params: unknown): Record<string, unknown> | null {
  const [request] = Array.isArray(params) ? params : [];
  return isRecord(request) ? request : null;
}

export function ensureReceipts(protocolRuntime: ProtocolRuntimeState): Record<string, ProtocolReceipt | null> {
  protocolRuntime.receipts = protocolRuntime.receipts ?? {};
  return protocolRuntime.receipts;
}

export function nextProtocolTxHash(protocolRuntime: ProtocolRuntimeState): string {
  protocolRuntime.nextTxId = (protocolRuntime.nextTxId ?? 0) + 1;
  return `0x${protocolRuntime.nextTxId.toString(16).padStart(64, "0")}`;
}

export function createReceipt(txHash: string, status: "0x1" | "0x0", blockNumber = 1n): ProtocolReceipt {
  return {
    transactionHash: txHash,
    status,
    blockNumber: hexQuantity(blockNumber),
    logs: [],
  };
}

export function tokenAssetKey(address: string): string {
  return normalizeAddress(address);
}

export function cloneWalletAssets(walletSession: LunaWalletSession): LunaWalletSession["assets"] {
  return {
    nativeBalance: walletSession.assets.nativeBalance,
    tokens: Object.fromEntries(
      Object.entries(walletSession.assets.tokens).map(([address, asset]) => [address, { ...asset }]),
    ),
  };
}

export function getWalletToken(walletSession: LunaWalletSession, address: string): LunaWalletSession["assets"]["tokens"][string] | null {
  return walletSession.assets.tokens[tokenAssetKey(address)] ?? null;
}
