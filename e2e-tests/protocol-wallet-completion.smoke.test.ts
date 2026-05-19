import { afterEach, describe, expect, it } from "vitest";

import { materializeProtocolPreset } from "@lunatest/core";
import { createLunaRuntimeIntercept, type RuntimeInterceptHandle } from "@lunatest/runtime-intercept";

const OWNER = "0x1111111111111111111111111111111111111111";

const handles: RuntimeInterceptHandle[] = [];

afterEach(() => {
  for (const handle of handles.splice(0).reverse()) {
    handle.disable();
  }
});

function word(value: string): string {
  return value.replace(/^0x/i, "").padStart(64, "0").toLowerCase();
}

function addressWord(address: string): string {
  return word(address);
}

function uintWord(value: string | number | bigint): string {
  return BigInt(value).toString(16).padStart(64, "0");
}

function getEthereum(): {
  request: (payload: { method: string; params?: unknown[] }) => Promise<unknown>;
} {
  const ethereum = (globalThis as unknown as { window?: { ethereum?: unknown } }).window?.ethereum;
  if (!ethereum || typeof (ethereum as { request?: unknown }).request !== "function") {
    throw new Error("Luna ethereum provider was not installed");
  }

  return ethereum as { request: (payload: { method: string; params?: unknown[] }) => Promise<unknown> };
}

function runtimeStateOf(materialized: Awaited<ReturnType<typeof materializeProtocolPreset>>): Record<string, unknown> {
  return materialized.interceptState.protocolRuntime as Record<string, unknown>;
}

function enableMaterializedRuntime(materialized: Awaited<ReturnType<typeof materializeProtocolPreset>>): RuntimeInterceptHandle {
  const handle = createLunaRuntimeIntercept({
    enable: true,
    wallet: {
      session: {
        ...materialized.walletSession,
        enabled: true,
        connected: true,
        accounts: [OWNER],
        permissions: [{ parentCapability: "eth_accounts" }],
      },
    },
    intercept: {
      mode: "strict",
      routes: materialized.routeMocks,
      mockResponses: {},
    },
  });

  handle.enable("development");
  handle.setRouteMocks?.(materialized.routeMocks);
  handle.applyInterceptState?.(materialized.interceptState);
  handle.setWalletSession?.({
    ...materialized.walletSession,
    enabled: true,
    connected: true,
    accounts: [OWNER],
    permissions: [{ parentCapability: "eth_accounts" }],
  });
  handles.push(handle);
  return handle;
}

describe("e2e smoke: protocol wallet completion", () => {
  it("runs a built-in Uniswap V3 quote, approve, swap, and receipt flow", async () => {
    const materialized = await materializeProtocolPreset("uniswap_v3");
    const runtimeState = runtimeStateOf(materialized);
    const contracts = runtimeState.contracts as Record<string, string>;
    const pool = (runtimeState.uniswapV3 as { pools: Array<{ token0: string; token1: string; fee: number }> }).pools[0];
    enableMaterializedRuntime(materialized);
    const ethereum = getEthereum();

    await expect(ethereum.request({ method: "eth_chainId" })).resolves.toBe(materialized.walletSession.chainId);
    await expect(
      ethereum.request({
        method: "eth_call",
        params: [
          {
            to: pool.token0,
            data: `0x70a08231${addressWord(OWNER)}`,
          },
          "latest",
        ],
      }),
    ).resolves.toBe("0x0000000000000000000000000000000000000000000000000000000000000019");

    await expect(
      ethereum.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: OWNER,
            to: pool.token0,
            data: `0x095ea7b3${addressWord(contracts.router)}${uintWord(10)}`,
          },
        ],
      }),
    ).resolves.toMatch(/^0x[0-9a-f]{64}$/);

    await expect(
      ethereum.request({
        method: "eth_call",
        params: [
          {
            to: contracts.quoter,
            data: `0xf7729d43${addressWord(pool.token0)}${addressWord(pool.token1)}${uintWord(pool.fee)}${uintWord(2)}${uintWord(0)}`,
          },
          "latest",
        ],
      }),
    ).resolves.toBe("0x0000000000000000000000000000000000000000000000000000000000000e10");

    const txHash = await ethereum.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: OWNER,
          to: contracts.router,
          data: `0x414bf389${addressWord(pool.token0)}${addressWord(pool.token1)}${uintWord(pool.fee)}${addressWord(OWNER)}${uintWord(999999)}${uintWord(1)}${uintWord(0)}${uintWord(0)}`,
        },
      ],
    });

    await expect(
      ethereum.request({
        method: "eth_getTransactionReceipt",
        params: [txHash],
      }),
    ).resolves.toMatchObject({
      status: "0x1",
      transactionHash: txHash,
    });
  });

  it("materializes every built-in protocol with routes and one ERC-20 read", async () => {
    for (const id of ["uniswap_v2", "uniswap_v3", "curve", "aave"]) {
      const materialized = await materializeProtocolPreset(id);
      const runtimeState = runtimeStateOf(materialized);
      const tokens = Object.keys(runtimeState.tokens as Record<string, unknown>);
      enableMaterializedRuntime(materialized);
      const ethereum = getEthereum();

      expect(runtimeState).toMatchObject({
        activeProtocol: id,
        supportLevel: "L3",
      });
      expect(
        materialized.routeMocks
          .filter((route) => route.endpointType === "ethereum")
          .map((route) => route.method),
      ).toEqual(
        expect.arrayContaining(["eth_call", "eth_sendTransaction", "eth_getTransactionReceipt", "eth_getLogs"]),
      );
      expect(tokens.length).toBeGreaterThan(0);
      await expect(
        ethereum.request({
          method: "eth_call",
          params: [
            {
              to: tokens[0],
              data: "0x313ce567",
            },
            "latest",
          ],
        }),
      ).resolves.toMatch(/^0x[0-9a-f]{64}$/);
    }
  });
});
