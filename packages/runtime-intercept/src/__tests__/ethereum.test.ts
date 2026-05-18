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

  it("uses provider error codes for unknown chains, rejected methods, and unsupported wallet methods", async () => {
    target.window = {};
    let walletSession = createLunaWalletSession({
      enabled: true,
      connected: true,
      chainId: "0x1",
      accounts: ["0x1111111111111111111111111111111111111111"],
      permissions: ["eth_accounts"],
      knownChains: {
        "0x1": {
          chainId: "0x1",
          chainName: "Ethereum",
        },
      },
      behavior: {
        userRejectedMethods: ["personal_sign"],
      },
    });

    const restore = installEthereumInterceptor(
      normalizeRuntimeInterceptConfig({
        enable: true,
        intercept: {
          mode: "strict",
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
            assets: next.assets ?? walletSession.assets,
            knownChains: next.knownChains ?? walletSession.knownChains,
            watchedAssets: next.watchedAssets ?? walletSession.watchedAssets,
            behavior: next.behavior ?? walletSession.behavior,
          });
          return walletSession;
        },
      },
    );

    const ethereum = target.window?.ethereum as {
      request: (payload: { method: string; params?: unknown[] }) => Promise<unknown>;
    };

    await expect(
      ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }],
      }),
    ).rejects.toMatchObject({
      code: 4902,
    });
    await expect(
      ethereum.request({
        method: "personal_sign",
        params: ["0x68656c6c6f", "0x1111111111111111111111111111111111111111"],
      }),
    ).rejects.toMatchObject({
      code: 4001,
    });
    await expect(ethereum.request({ method: "wallet_lunaUnsupported" })).rejects.toMatchObject({
      code: 4200,
    });

    restore();
  });

  it("adds chains, switches chains, signs payloads, watches assets, and answers balance/gas/block methods", async () => {
    target.window = {};
    let walletSession = createLunaWalletSession({
      enabled: true,
      connected: true,
      chainId: "0x1",
      accounts: ["0x1111111111111111111111111111111111111111"],
      permissions: ["eth_accounts"],
      assets: {
        nativeBalance: "1000000000000000000",
        tokens: {},
      },
      knownChains: {
        "0x1": {
          chainId: "0x1",
          chainName: "Ethereum",
        },
      },
    });

    const restore = installEthereumInterceptor(
      normalizeRuntimeInterceptConfig({
        enable: true,
        intercept: {
          mode: "strict",
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
            assets: next.assets ?? walletSession.assets,
            knownChains: next.knownChains ?? walletSession.knownChains,
            watchedAssets: next.watchedAssets ?? walletSession.watchedAssets,
            behavior: next.behavior ?? walletSession.behavior,
          });
          return walletSession;
        },
      },
    );

    const ethereum = target.window?.ethereum as {
      on: (event: string, listener: (...args: unknown[]) => void) => unknown;
      request: (payload: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
    const chainEvents: unknown[] = [];
    ethereum.on("chainChanged", (chainId) => chainEvents.push(chainId));

    await expect(
      ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0xaa36a7",
            chainName: "Sepolia",
            rpcUrls: ["https://example.invalid/sepolia"],
          },
        ],
      }),
    ).resolves.toBe(null);
    await expect(
      ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }],
      }),
    ).resolves.toBe(null);
    expect(chainEvents).toEqual(["0xaa36a7"]);

    await expect(
      ethereum.request({
        method: "eth_getBalance",
        params: ["0x1111111111111111111111111111111111111111", "latest"],
      }),
    ).resolves.toBe("0xde0b6b3a7640000");
    await expect(ethereum.request({ method: "net_version" })).resolves.toBe("11155111");
    await expect(ethereum.request({ method: "eth_maxPriorityFeePerGas" })).resolves.toMatch(/^0x[0-9a-f]+$/);
    await expect(
      ethereum.request({ method: "eth_feeHistory", params: ["0x2", "latest", [10, 50]] }),
    ).resolves.toMatchObject({
      oldestBlock: expect.any(String),
      baseFeePerGas: [expect.any(String), expect.any(String), expect.any(String)],
      gasUsedRatio: [expect.any(Number), expect.any(Number)],
      reward: [
        [expect.any(String), expect.any(String)],
        [expect.any(String), expect.any(String)],
      ],
    });
    await expect(
      ethereum.request({ method: "eth_getBlockByNumber", params: ["latest", false] }),
    ).resolves.toMatchObject({
      number: expect.any(String),
      hash: expect.stringMatching(/^0x[0-9a-f]{64}$/),
      timestamp: expect.any(String),
    });

    const personalSignature = await ethereum.request({
      method: "personal_sign",
      params: ["0x68656c6c6f", "0x1111111111111111111111111111111111111111"],
    });
    const typedSignature = await ethereum.request({
      method: "eth_signTypedData_v4",
      params: [
        "0x1111111111111111111111111111111111111111",
        JSON.stringify({
          domain: { name: "LunaTest" },
          message: { value: "hello" },
          primaryType: "Message",
          types: { Message: [{ name: "value", type: "string" }] },
        }),
      ],
    });
    expect(String(personalSignature)).toMatch(/^0x[0-9a-f]{130}$/);
    expect(String(typedSignature)).toMatch(/^0x[0-9a-f]{130}$/);

    await expect(
      ethereum.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address: "0x2222222222222222222222222222222222222222",
            symbol: "MOCK",
            decimals: 18,
          },
        },
      }),
    ).resolves.toBe(true);
    expect(walletSession.watchedAssets).toEqual([
      {
        type: "ERC20",
        options: {
          address: "0x2222222222222222222222222222222222222222",
          symbol: "MOCK",
          decimals: 18,
        },
      },
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
