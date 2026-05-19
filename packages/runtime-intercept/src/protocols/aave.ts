import { createProviderError } from "../provider-errors.js";
import { concatHexWords, selector, uint256Hex, uintFromWord, wordAt } from "./hex.js";
import { cloneWalletAssets, normalizeAddress, tokenAssetKey, type ProtocolCallInput, type ProtocolTransactionEffect, type ProtocolTransactionInput } from "./state.js";

const SELECTORS = {
  getUserAccountData: "0xbf92857c",
  getReserveData: "0x35ea6a75",
  getAssetPrice: "0x41976e09",
  supply: "0x617ba037",
  withdraw: "0x69328dec",
  borrow: "0xa415bcad",
  repay: "0x573ade81",
} as const;

function reserve(input: ProtocolCallInput | ProtocolTransactionInput) {
  return input.protocolRuntime.aave?.reserves?.[0] ?? null;
}

function isAaveContract(input: ProtocolCallInput | ProtocolTransactionInput): boolean {
  const to = normalizeAddress(input.to);
  const state = input.protocolRuntime.aave;
  if (!state) {
    return false;
  }
  return [state.pool, state.oracle].some((address) => normalizeAddress(address) === to);
}

export function resolveAaveCall(input: ProtocolCallInput): unknown | null {
  if (!isAaveContract(input)) {
    return null;
  }
  const currentSelector = selector(input.data);
  const activeReserve = reserve(input);

  if (currentSelector === SELECTORS.getAssetPrice) {
    return uint256Hex(activeReserve?.price ?? "100000000");
  }
  if (currentSelector === SELECTORS.getReserveData) {
    return concatHexWords(Array.from({ length: 12 }, (_, index) => index === 0 ? "1" : "0"));
  }
  if (currentSelector === SELECTORS.getUserAccountData) {
    return concatHexWords(["1000", "100", "900", "8000", "8250", "2000000000000000000"]);
  }

  throw createProviderError(4200, `Unsupported Aave selector ${currentSelector ?? "unknown"}`);
}

export function applyAaveTransaction(input: ProtocolTransactionInput): ProtocolTransactionEffect {
  if (!isAaveContract(input)) {
    return { handled: false };
  }
  const currentSelector = selector(input.data);
  if (
    currentSelector !== SELECTORS.supply &&
    currentSelector !== SELECTORS.withdraw &&
    currentSelector !== SELECTORS.borrow &&
    currentSelector !== SELECTORS.repay
  ) {
    throw createProviderError(4200, `Unsupported Aave transaction selector ${currentSelector ?? "unknown"}`);
  }

  const activeReserve = reserve(input);
  if (!activeReserve) {
    return { handled: true, status: "0x0" };
  }

  const amount = uintFromWord(wordAt(input.data, 1)) || 1n;
  const assets = cloneWalletAssets(input.walletSession);
  const tokenKey = tokenAssetKey(activeReserve.asset);
  const token = assets.tokens[tokenKey] ?? {
    balance: "0",
    allowance: "0",
    symbol: activeReserve.symbol,
    decimals: 6,
  };

  if (currentSelector === SELECTORS.supply || currentSelector === SELECTORS.repay) {
    if (BigInt(token.balance) < amount) {
      return { handled: true, status: "0x0" };
    }
    token.balance = (BigInt(token.balance) - amount).toString(10);
  } else {
    token.balance = (BigInt(token.balance) + amount).toString(10);
  }

  assets.tokens[tokenKey] = token;
  input.setWalletSession({ assets });
  return { handled: true, status: "0x1" };
}
