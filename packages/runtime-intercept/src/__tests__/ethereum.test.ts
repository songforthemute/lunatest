import { afterEach, describe, expect, it } from "vitest";

import { installEthereumInterceptor } from "../interceptors/ethereum";
import { createLogger } from "../logger";
import { normalizeRuntimeInterceptConfig } from "../runtime";
import { createLunaWalletSession } from "@lunatest/contracts";

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

  it("handles luna wallet session requests when enabled", async () => {
    target.window = {};
    let walletSession = createLunaWalletSession({
      enabled: true,
      connected: false,
      chainId: "0xaa36a7",
      accounts: ["0x1111111111111111111111111111111111111111"],
      permissions: [],
    });

    const restore = installEthereumInterceptor(
      normalizeRuntimeInterceptConfig({
        enable: true,
        intercept: {
          mode: "permissive",
        },
      }),
      createLogger(false),
      {
        getWalletSession: () => walletSession,
        setWalletSession: (next) => {
          walletSession = createLunaWalletSession({
            ...walletSession,
            ...next,
            accounts: next.accounts ?? walletSession.accounts,
            permissions: next.permissions ?? walletSession.permissions,
          });
          return walletSession;
        },
      },
    );

    const ethereum = target.window?.ethereum as {
      request: (payload: { method: string; params?: unknown[] }) => Promise<unknown>;
    };

    await expect(ethereum.request({ method: "eth_accounts" })).resolves.toEqual([]);
    await expect(ethereum.request({ method: "eth_requestAccounts" })).resolves.toEqual([
      "0x1111111111111111111111111111111111111111",
    ]);
    await expect(ethereum.request({ method: "wallet_getPermissions" })).resolves.toEqual([
      { parentCapability: "eth_accounts" },
    ]);

    restore();
  });

  it("removes synthetic window after restore", async () => {
    target.window = undefined;

    const restore = installEthereumInterceptor(
      normalizeRuntimeInterceptConfig({
        enable: true,
        intercept: {
          mode: "permissive",
        },
      }),
      createLogger(false),
    );

    restore();

    expect("window" in target).toBe(false);
  });
});
