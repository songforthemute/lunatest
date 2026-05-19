import { createProviderError } from "../provider-errors.js";
import { applyTokenTransfer } from "./erc20.js";
import { concatHexWords, selector, uint256Hex, uintFromWord, wordAt, wordFromAddress } from "./hex.js";
import { normalizeAddress, type ProtocolCallInput, type ProtocolTransactionEffect, type ProtocolTransactionInput } from "./state.js";

const SELECTORS = {
  coins: "0xc6610657",
  balances: "0x4903b0d1",
  getDy: "0x5e0d443f",
  exchange: "0x3df02124",
  getVirtualPrice: "0xbb7b8b80",
} as const;

function pool(input: ProtocolCallInput | ProtocolTransactionInput) {
  return input.protocolRuntime.curve?.pools?.[0] ?? null;
}

function isCurveContract(input: ProtocolCallInput | ProtocolTransactionInput): boolean {
  const to = normalizeAddress(input.to);
  const state = input.protocolRuntime.curve;
  if (!state) {
    return false;
  }
  return [state.router, ...(state.pools ?? []).map((item) => item.address)].some(
    (address) => typeof address === "string" && normalizeAddress(address) === to,
  );
}

function quote(input: ProtocolCallInput | ProtocolTransactionInput, amountIn: bigint): bigint {
  const activePool = pool(input);
  const feeBps = BigInt(activePool?.feeBps ?? 4);
  return (amountIn * (10_000n - feeBps)) / 10_000n;
}

export function resolveCurveCall(input: ProtocolCallInput): unknown | null {
  if (!isCurveContract(input)) {
    return null;
  }
  const currentSelector = selector(input.data);
  const activePool = pool(input);

  if (currentSelector === SELECTORS.coins) {
    const index = Number(uintFromWord(wordAt(input.data, 0)));
    return `0x${wordFromAddress(activePool?.coins[index] ?? "0x0000000000000000000000000000000000000000")}`;
  }
  if (currentSelector === SELECTORS.balances) {
    const index = Number(uintFromWord(wordAt(input.data, 0)));
    return uint256Hex(activePool?.balances[index] ?? "0");
  }
  if (currentSelector === SELECTORS.getDy) {
    return uint256Hex(quote(input, uintFromWord(wordAt(input.data, 2))));
  }
  if (currentSelector === SELECTORS.getVirtualPrice) {
    return uint256Hex(activePool?.virtualPrice ?? "1000000000000000000");
  }

  throw createProviderError(4200, `Unsupported Curve selector ${currentSelector ?? "unknown"}`);
}

export function applyCurveTransaction(input: ProtocolTransactionInput): ProtocolTransactionEffect {
  if (!isCurveContract(input)) {
    return { handled: false };
  }
  if (selector(input.data) !== SELECTORS.exchange) {
    throw createProviderError(4200, "Unsupported Curve transaction selector");
  }
  const activePool = pool(input);
  if (!activePool || activePool.coins.length < 2) {
    return { handled: true, status: "0x0" };
  }
  const amountIn = uintFromWord(wordAt(input.data, 2)) || 1n;
  const transferred = applyTokenTransfer({
    walletSession: input.walletSession,
    setWalletSession: input.setWalletSession,
    tokenIn: activePool.coins[0],
    tokenOut: activePool.coins[1],
    amountIn,
    amountOut: quote(input, amountIn),
  });
  return { handled: true, status: transferred ? "0x1" : "0x0" };
}
