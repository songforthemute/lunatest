import { createProviderError } from "../provider-errors.js";
import { applyTokenTransfer } from "./erc20.js";
import { concatHexWords, selector, uint256Hex, uintFromWord, wordAt } from "./hex.js";
import {
  normalizeAddress,
  type ProtocolCallInput,
  type ProtocolTransactionEffect,
  type ProtocolTransactionInput,
} from "./state.js";

const SELECTORS = {
  quoteExactInputSingleV1: "0xf7729d43",
  quoteExactOutputSingleV1: "0x30d07f21",
  quoteExactInputSingleV2: "0xc6a5026a",
  slot0: "0x3850c7bd",
  liquidity: "0x1a686502",
  exactInputSingle: "0x414bf389",
} as const;

function firstPool(input: ProtocolCallInput | ProtocolTransactionInput) {
  return input.protocolRuntime.uniswapV3?.pools?.[0] ?? null;
}

function quote(input: ProtocolCallInput | ProtocolTransactionInput, amountIn: bigint): bigint {
  const pool = firstPool(input);
  if (!pool) {
    return 0n;
  }

  return (amountIn * BigInt(pool.priceNumerator)) / BigInt(pool.priceDenominator || "1");
}

function isV3Contract(input: ProtocolCallInput | ProtocolTransactionInput): boolean {
  const to = normalizeAddress(input.to);
  const state = input.protocolRuntime.uniswapV3;
  if (!state) {
    return false;
  }

  return [state.router, state.quoter, ...(state.pools ?? []).map((pool) => pool.address)].some(
    (address) => typeof address === "string" && normalizeAddress(address) === to,
  );
}

export function resolveUniswapV3Call(input: ProtocolCallInput): unknown | null {
  if (!isV3Contract(input)) {
    return null;
  }

  const currentSelector = selector(input.data);
  if (currentSelector === SELECTORS.quoteExactInputSingleV1) {
    return uint256Hex(quote(input, uintFromWord(wordAt(input.data, 3))));
  }

  if (currentSelector === SELECTORS.quoteExactOutputSingleV1) {
    const desiredOut = uintFromWord(wordAt(input.data, 3));
    const pool = firstPool(input);
    const amountIn = pool
      ? (desiredOut * BigInt(pool.priceDenominator || "1")) / BigInt(pool.priceNumerator || "1")
      : 0n;
    return uint256Hex(amountIn);
  }

  if (currentSelector === SELECTORS.quoteExactInputSingleV2) {
    return uint256Hex(quote(input, 1n));
  }

  if (currentSelector === SELECTORS.slot0) {
    return concatHexWords([
      BigInt(2) ** 96n,
      0,
      0,
      0,
      0,
      0,
      1,
    ].map((value) => BigInt(value).toString(16)));
  }

  if (currentSelector === SELECTORS.liquidity) {
    return uint256Hex(firstPool(input)?.liquidity ?? "1000000");
  }

  throw createProviderError(4200, `Unsupported Uniswap V3 selector ${currentSelector ?? "unknown"}`);
}

export function applyUniswapV3Transaction(input: ProtocolTransactionInput): ProtocolTransactionEffect {
  if (!isV3Contract(input)) {
    return { handled: false };
  }

  const currentSelector = selector(input.data);
  if (currentSelector !== SELECTORS.exactInputSingle) {
    throw createProviderError(4200, `Unsupported Uniswap V3 transaction selector ${currentSelector ?? "unknown"}`);
  }

  const pool = firstPool(input);
  if (!pool) {
    return { handled: true, status: "0x0" };
  }

  const amountIn = 1n;
  const amountOut = quote(input, amountIn);
  const transferred = applyTokenTransfer({
    walletSession: input.walletSession,
    setWalletSession: input.setWalletSession,
    tokenIn: pool.token0,
    tokenOut: pool.token1,
    amountIn,
    amountOut,
  });

  return { handled: true, status: transferred ? "0x1" : "0x0" };
}
