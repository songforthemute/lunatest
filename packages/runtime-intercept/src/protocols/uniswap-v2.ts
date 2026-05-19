import { createProviderError } from "../provider-errors.js";
import { applyTokenTransfer } from "./erc20.js";
import { addressFromWord, encodeUintArray, selector, uint256Hex, uintFromWord, wordAt, wordFromAddress, concatHexWords } from "./hex.js";
import { normalizeAddress, type ProtocolCallInput, type ProtocolTransactionEffect, type ProtocolTransactionInput } from "./state.js";

const SELECTORS = {
  getPair: "0xe6a43905",
  getReserves: "0x0902f1ac",
  getAmountsOut: "0xd06ca61f",
  getAmountsIn: "0x1f00ca74",
  swapExactTokensForTokens: "0x38ed1739",
} as const;

function pair(input: ProtocolCallInput | ProtocolTransactionInput) {
  return input.protocolRuntime.uniswapV2?.pairs?.[0] ?? null;
}

function quote(input: ProtocolCallInput | ProtocolTransactionInput, amountIn: bigint): bigint {
  const activePair = pair(input);
  if (!activePair) {
    return 0n;
  }
  const reserveIn = BigInt(activePair.reserve0 || "1");
  const reserveOut = BigInt(activePair.reserve1 || "1");
  return (amountIn * reserveOut) / reserveIn;
}

function isV2Contract(input: ProtocolCallInput | ProtocolTransactionInput): boolean {
  const to = normalizeAddress(input.to);
  const state = input.protocolRuntime.uniswapV2;
  if (!state) {
    return false;
  }
  return [state.router, state.factory, ...(state.pairs ?? []).map((item) => item.address)].some(
    (address) => typeof address === "string" && normalizeAddress(address) === to,
  );
}

export function resolveUniswapV2Call(input: ProtocolCallInput): unknown | null {
  if (!isV2Contract(input)) {
    return null;
  }
  const currentSelector = selector(input.data);
  const activePair = pair(input);

  if (currentSelector === SELECTORS.getPair) {
    return `0x${wordFromAddress(activePair?.address ?? input.protocolRuntime.uniswapV2?.router ?? "0x0000000000000000000000000000000000000000")}`;
  }
  if (currentSelector === SELECTORS.getReserves) {
    return concatHexWords([activePair?.reserve0 ?? "0", activePair?.reserve1 ?? "0", "0"]);
  }
  if (currentSelector === SELECTORS.getAmountsOut) {
    const amountIn = uintFromWord(wordAt(input.data, 0));
    return encodeUintArray([amountIn, quote(input, amountIn)]);
  }
  if (currentSelector === SELECTORS.getAmountsIn) {
    const amountOut = uintFromWord(wordAt(input.data, 0));
    const reserveIn = BigInt(activePair?.reserve0 ?? "1");
    const reserveOut = BigInt(activePair?.reserve1 ?? "1");
    return encodeUintArray([(amountOut * reserveIn) / reserveOut, amountOut]);
  }

  throw createProviderError(4200, `Unsupported Uniswap V2 selector ${currentSelector ?? "unknown"}`);
}

export function applyUniswapV2Transaction(input: ProtocolTransactionInput): ProtocolTransactionEffect {
  if (!isV2Contract(input)) {
    return { handled: false };
  }
  if (selector(input.data) !== SELECTORS.swapExactTokensForTokens) {
    throw createProviderError(4200, "Unsupported Uniswap V2 transaction selector");
  }
  const activePair = pair(input);
  if (!activePair) {
    return { handled: true, status: "0x0" };
  }
  const amountIn = uintFromWord(wordAt(input.data, 0)) || 1n;
  const transferred = applyTokenTransfer({
    walletSession: input.walletSession,
    setWalletSession: input.setWalletSession,
    tokenIn: activePair.token0,
    tokenOut: activePair.token1,
    amountIn,
    amountOut: quote(input, amountIn),
  });
  return { handled: true, status: transferred ? "0x1" : "0x0" };
}
