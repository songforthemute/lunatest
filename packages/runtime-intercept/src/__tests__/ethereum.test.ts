import { afterEach, describe, expect, it } from "vitest";

import { installEthereumInterceptor } from "../interceptors/ethereum";
import { createLogger } from "../logger";
import { normalizeRuntimeInterceptConfig } from "../runtime";

const target = globalThis as {
  window?: Record<string, unknown>;
};

const originalWindow = target.window;

afterEach(() => {
  target.window = originalWindow;
});

describe("ethereum interceptor", () => {
  it("injects ethereum and restores original provider", async () => {
    const originalEthereum = {
      marker: true,
      request: async () => "forwarded",
    };

    target.window = {
      ethereum: originalEthereum,
    };

    const restore = installEthereumInterceptor(
      normalizeRuntimeInterceptConfig({
        enable: true,
        intercept: {
          mode: "strict",
          routing: {
            ethereumMethods: [{ method: "eth_chainId", responseKey: "chain-id" }],
          },
          mockResponses: {
            "chain-id": { result: "0x1" },
          },
        },
      }),
      createLogger(false),
    );

    const ethereum = (target.window?.ethereum as {
      isLunaTest?: boolean;
      request: (payload: { method: string }) => Promise<unknown>;
    }) ?? { request: async () => undefined };

    expect(ethereum.isLunaTest).toBe(true);
    await expect(ethereum.request({ method: "eth_chainId" })).resolves.toBe("0x1");

    restore();
    expect(target.window?.ethereum).toBe(originalEthereum);
  });

  it("blocks unmatched method in strict mode", async () => {
    target.window = {};

    const restore = installEthereumInterceptor(
      normalizeRuntimeInterceptConfig({
        enable: true,
        intercept: {
          mode: "strict",
          routing: {
            ethereumMethods: [{ method: "eth_chainId", responseKey: "chain-id" }],
          },
          mockResponses: {
            "chain-id": { result: "0x1" },
          },
        },
      }),
      createLogger(false),
    );

    const ethereum = target.window?.ethereum as {
      request: (payload: { method: string }) => Promise<unknown>;
    };

    await expect(ethereum.request({ method: "eth_accounts" })).rejects.toThrow(
      "blocked unmatched ethereum request",
    );

    restore();
  });

  it("forwards unmatched method in permissive mode", async () => {
    const originalEthereum = {
      request: async (payload: { method: string }) => `forward:${payload.method}`,
    };

    target.window = {
      ethereum: originalEthereum,
    };

    const restore = installEthereumInterceptor(
      normalizeRuntimeInterceptConfig({
        enable: true,
        intercept: {
          mode: "permissive",
          routing: {
            ethereumMethods: [{ method: "eth_chainId", responseKey: "chain-id" }],
          },
          mockResponses: {
            "chain-id": { result: "0x1" },
          },
        },
      }),
      createLogger(false),
    );

    const ethereum = target.window?.ethereum as {
      request: (payload: { method: string }) => Promise<unknown>;
    };

    await expect(ethereum.request({ method: "wallet_requestPermissions" })).resolves.toBe(
      "forward:wallet_requestPermissions",
    );

    restore();
  });
});
