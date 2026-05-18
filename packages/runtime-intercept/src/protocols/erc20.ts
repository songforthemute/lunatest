import type { LunaWalletSession } from "@lunatest/contracts";
import { createProviderError } from "../provider-errors.js";
import {
  addressFromWord,
  encodeString,
  selector,
  uint256Hex,
  uintFromWord,
  wordAt,
} from "./hex.js";
import {
  cloneWalletAssets,
  getWalletToken,
  normalizeAddress,
  tokenAssetKey,
  type ProtocolCallInput,
  type ProtocolTransactionEffect,
  type ProtocolTransactionInput,
} from "./state.js";

const ERC20_SELECTORS = {
  symbol: "0x95d89b41",
  decimals: "0x313ce567",
  balanceOf: "0x70a08231",
  allowance: "0xdd62ed3e",
  approve: "0x095ea7b3",
} as const;

function isKnownToken(input: ProtocolCallInput | ProtocolTransactionInput): boolean {
  const address = tokenAssetKey(input.to);
  return Boolean(input.walletSession.assets.tokens[address] || input.protocolRuntime.tokens?.[address]);
}

function getTokenMetadata(input: ProtocolCallInput): { symbol: string; decimals: number } {
  const address = tokenAssetKey(input.to);
  const walletToken = input.walletSession.assets.tokens[address];
  const protocolToken = input.protocolRuntime.tokens?.[address];

  return {
    symbol: walletToken?.symbol ?? protocolToken?.symbol ?? "TOKEN",
    decimals: walletToken?.decimals ?? protocolToken?.decimals ?? 18,
  };
}

export function resolveErc20Call(input: ProtocolCallInput): unknown | null {
  if (!isKnownToken(input)) {
    return null;
  }

  const currentSelector = selector(input.data);
  if (currentSelector === ERC20_SELECTORS.symbol) {
    return encodeString(getTokenMetadata(input).symbol);
  }

  if (currentSelector === ERC20_SELECTORS.decimals) {
    return uint256Hex(getTokenMetadata(input).decimals);
  }

  if (currentSelector === ERC20_SELECTORS.balanceOf) {
    const owner = normalizeAddress(addressFromWord(wordAt(input.data, 0)));
    const walletAccounts = new Set(input.walletSession.accounts.map((account) => account.toLowerCase()));
    const walletToken = getWalletToken(input.walletSession, input.to);
    const protocolToken = input.protocolRuntime.tokens?.[tokenAssetKey(input.to)];
    const balance = walletAccounts.has(owner)
      ? walletToken?.balance
      : protocolToken?.balances?.[owner];

    return uint256Hex(balance ?? "0");
  }

  if (currentSelector === ERC20_SELECTORS.allowance) {
    const owner = normalizeAddress(addressFromWord(wordAt(input.data, 0)));
    const spender = normalizeAddress(addressFromWord(wordAt(input.data, 1)));
    const walletAccounts = new Set(input.walletSession.accounts.map((account) => account.toLowerCase()));
    const walletToken = getWalletToken(input.walletSession, input.to);
    const protocolToken = input.protocolRuntime.tokens?.[tokenAssetKey(input.to)];
    const allowance = walletAccounts.has(owner)
      ? walletToken?.allowance
      : protocolToken?.allowances?.[owner]?.[spender];

    return uint256Hex(allowance ?? "0");
  }

  throw createProviderError(4200, `Unsupported ERC-20 selector ${currentSelector ?? "unknown"}`);
}

export function applyErc20Transaction(input: ProtocolTransactionInput): ProtocolTransactionEffect {
  if (!isKnownToken(input)) {
    return { handled: false };
  }

  const currentSelector = selector(input.data);
  if (currentSelector !== ERC20_SELECTORS.approve) {
    throw createProviderError(4200, `Unsupported ERC-20 transaction selector ${currentSelector ?? "unknown"}`);
  }

  const spender = normalizeAddress(addressFromWord(wordAt(input.data, 0)));
  if (!spender) {
    throw createProviderError(4200, "ERC-20 approve requires a spender");
  }

  const amount = uintFromWord(wordAt(input.data, 1)).toString(10);
  const assets = cloneWalletAssets(input.walletSession);
  const tokenAddress = tokenAssetKey(input.to);
  const existing = assets.tokens[tokenAddress] ?? {
    balance: "0",
    allowance: "0",
  };

  assets.tokens[tokenAddress] = {
    ...existing,
    allowance: amount,
  };
  input.setWalletSession({ assets });

  return { handled: true, status: "0x1" };
}

export function applyTokenTransfer(input: {
  walletSession: LunaWalletSession;
  setWalletSession: (session: Partial<LunaWalletSession>) => LunaWalletSession;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  amountOut: bigint;
}): boolean {
  const assets = cloneWalletAssets(input.walletSession);
  const tokenInKey = tokenAssetKey(input.tokenIn);
  const tokenOutKey = tokenAssetKey(input.tokenOut);
  const tokenIn = assets.tokens[tokenInKey];
  const tokenOut = assets.tokens[tokenOutKey] ?? {
    balance: "0",
    allowance: "0",
  };

  if (!tokenIn) {
    return false;
  }

  const balanceIn = BigInt(tokenIn.balance);
  const allowance = BigInt(tokenIn.allowance);
  if (balanceIn < input.amountIn || allowance < input.amountIn) {
    return false;
  }

  tokenIn.balance = (balanceIn - input.amountIn).toString(10);
  tokenOut.balance = (BigInt(tokenOut.balance) + input.amountOut).toString(10);
  assets.tokens[tokenInKey] = tokenIn;
  assets.tokens[tokenOutKey] = tokenOut;
  input.setWalletSession({ assets });
  return true;
}
