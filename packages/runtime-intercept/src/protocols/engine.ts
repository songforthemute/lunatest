import { createProviderError } from "../provider-errors.js";
import { applyAaveTransaction, resolveAaveCall } from "./aave.js";
import { applyCurveTransaction, resolveCurveCall } from "./curve.js";
import { applyErc20Transaction, resolveErc20Call } from "./erc20.js";
import { applyUniswapV2Transaction, resolveUniswapV2Call } from "./uniswap-v2.js";
import { applyUniswapV3Transaction, resolveUniswapV3Call } from "./uniswap-v3.js";
import {
  createReceipt,
  ensureReceipts,
  getCallRequest,
  getProtocolRuntimeState,
  getTransactionRequest,
  nextProtocolTxHash,
  normalizeAddress,
  type ProtocolCallInput,
  type ProtocolResolution,
  type ProtocolResolverInput,
  type ProtocolTransactionEffect,
  type ProtocolTransactionInput,
} from "./state.js";

function requestAddress(request: Record<string, unknown>): string | null {
  return typeof request.to === "string" ? normalizeAddress(request.to) : null;
}

function requestData(request: Record<string, unknown>): string {
  return typeof request.data === "string" ? request.data : "0x";
}

function resolveProtocolCall(input: ProtocolCallInput): unknown | null {
  const erc20 = resolveErc20Call(input);
  if (erc20 !== null) {
    return erc20;
  }

  if (input.protocolRuntime.activeProtocol === "uniswap_v3") {
    return resolveUniswapV3Call(input);
  }
  if (input.protocolRuntime.activeProtocol === "uniswap_v2") {
    return resolveUniswapV2Call(input);
  }
  if (input.protocolRuntime.activeProtocol === "curve") {
    return resolveCurveCall(input);
  }
  if (input.protocolRuntime.activeProtocol === "aave") {
    return resolveAaveCall(input);
  }

  return null;
}

function applyProtocolTransaction(input: ProtocolTransactionInput): ProtocolTransactionEffect {
  const erc20 = applyErc20Transaction(input);
  if (erc20.handled) {
    return erc20;
  }

  if (input.protocolRuntime.activeProtocol === "uniswap_v3") {
    return applyUniswapV3Transaction(input);
  }
  if (input.protocolRuntime.activeProtocol === "uniswap_v2") {
    return applyUniswapV2Transaction(input);
  }
  if (input.protocolRuntime.activeProtocol === "curve") {
    return applyCurveTransaction(input);
  }
  if (input.protocolRuntime.activeProtocol === "aave") {
    return applyAaveTransaction(input);
  }

  return { handled: false };
}

export function resolveProtocolRequest(input: ProtocolResolverInput): ProtocolResolution {
  const protocolRuntime = getProtocolRuntimeState(input.runtimeState);
  if (!protocolRuntime) {
    return { handled: false };
  }

  if (protocolRuntime.transactionBehavior?.userRejectedMethods?.includes(input.method)) {
    throw createProviderError(4001, `Protocol runtime rejected ${input.method}`);
  }

  if (input.method === "eth_getLogs") {
    return { handled: true, result: [] };
  }

  if (input.method === "eth_getTransactionReceipt") {
    const [txHash] = Array.isArray(input.params) ? input.params : [];
    if (typeof txHash !== "string") {
      return { handled: true, result: null };
    }

    return {
      handled: true,
      result: ensureReceipts(protocolRuntime)[txHash] ?? null,
    };
  }

  if (input.method === "eth_call") {
    const request = getCallRequest(input.params);
    if (!request) {
      return { handled: false };
    }
    const to = requestAddress(request);
    if (!to) {
      return { handled: false };
    }

    const result = resolveProtocolCall({
      ...input,
      to,
      data: requestData(request),
      protocolRuntime,
    });

    return result === null ? { handled: false } : { handled: true, result };
  }

  if (input.method === "eth_sendTransaction") {
    const request = getTransactionRequest(input.params);
    if (!request) {
      return { handled: false };
    }
    const to = requestAddress(request);
    if (!to) {
      return { handled: false };
    }

    const effect = applyProtocolTransaction({
      ...input,
      to,
      from: typeof request.from === "string" ? normalizeAddress(request.from) : undefined,
      data: requestData(request),
      protocolRuntime,
    });
    if (!effect.handled) {
      return { handled: false };
    }

    const txHash = nextProtocolTxHash(protocolRuntime);
    const forceRevert = protocolRuntime.transactionBehavior?.forceRevert === true;
    const status = forceRevert ? "0x0" : effect.status ?? "0x1";
    ensureReceipts(protocolRuntime)[txHash] = protocolRuntime.transactionBehavior?.forcePending === true
      ? null
      : createReceipt(txHash, status);

    return { handled: true, result: txHash };
  }

  return { handled: false };
}
