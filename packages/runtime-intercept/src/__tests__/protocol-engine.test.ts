import { describe, expect, it } from "vitest";

import { createLunaWalletSession, type LunaWalletSession } from "@lunatest/contracts";
import { resolveProtocolRequest } from "../protocols/engine";

const OWNER = "0x1111111111111111111111111111111111111111";
const TOKEN_IN = "0x2222222222222222222222222222222222222222";
const TOKEN_OUT = "0x3333333333333333333333333333333333333333";
const ROUTER = "0x4444444444444444444444444444444444444444";
const QUOTER = "0x5555555555555555555555555555555555555555";

function word(value: string): string {
  return value.replace(/^0x/i, "").padStart(64, "0").toLowerCase();
}

function addressWord(address: string): string {
  return word(address);
}

function uintWord(value: string | number | bigint): string {
  return BigInt(value).toString(16).padStart(64, "0");
}

function decodeUint(value: unknown): bigint {
  if (typeof value !== "string") {
    throw new Error("Expected hex string");
  }

  return BigInt(value);
}

function baseRuntimeState(): Record<string, unknown> {
  return {
    protocolRuntime: {
      activeProtocol: "uniswap_v3",
      chainId: 11155111,
      tokens: {
        [TOKEN_IN.toLowerCase()]: {
          symbol: "TIN",
          decimals: 18,
        },
        [TOKEN_OUT.toLowerCase()]: {
          symbol: "TOUT",
          decimals: 6,
        },
      },
      uniswapV3: {
        router: ROUTER,
        quoter: QUOTER,
        quoterVersion: "v1",
        pools: [
          {
            token0: TOKEN_IN,
            token1: TOKEN_OUT,
            fee: 3000,
            priceNumerator: "1800",
            priceDenominator: "1",
          },
        ],
      },
    },
  };
}

function baseWalletSession(): LunaWalletSession {
  return createLunaWalletSession({
    enabled: true,
    connected: true,
    accounts: [OWNER],
    permissions: ["eth_accounts"],
    assets: {
      nativeBalance: "1000000000000000000",
      tokens: {
        [TOKEN_IN]: {
          balance: "25",
          allowance: "0",
          symbol: "TIN",
          decimals: 18,
        },
        [TOKEN_OUT]: {
          balance: "0",
          allowance: "0",
          symbol: "TOUT",
          decimals: 6,
        },
      },
    },
  });
}

describe("protocol runtime engine", () => {
  it("resolves ERC-20 reads and approve effects from wallet state", () => {
    const runtimeState = baseRuntimeState();
    let walletSession = baseWalletSession();

    const setWalletSession = (session: Partial<LunaWalletSession>): LunaWalletSession => {
      walletSession = createLunaWalletSession({
        ...walletSession,
        ...session,
        accounts: session.accounts ?? walletSession.accounts,
        permissions: session.permissions ?? walletSession.permissions,
        assets: session.assets ?? walletSession.assets,
      });
      return walletSession;
    };

    const balance = resolveProtocolRequest({
      method: "eth_call",
      params: [
        {
          to: TOKEN_IN,
          data: `0x70a08231${addressWord(OWNER)}`,
        },
        "latest",
      ],
      runtimeState,
      walletSession,
      setWalletSession,
    });

    expect(balance).toEqual({
      handled: true,
      result: `0x${uintWord(25)}`,
    });

    const approve = resolveProtocolRequest({
      method: "eth_sendTransaction",
      params: [
        {
          from: OWNER,
          to: TOKEN_IN,
          data: `0x095ea7b3${addressWord(ROUTER)}${uintWord(100)}`,
        },
      ],
      runtimeState,
      walletSession,
      setWalletSession,
    });

    expect(approve.handled).toBe(true);
    expect(walletSession.assets.tokens[TOKEN_IN.toLowerCase()].allowance).toBe("100");

    const allowance = resolveProtocolRequest({
      method: "eth_call",
      params: [
        {
          to: TOKEN_IN,
          data: `0xdd62ed3e${addressWord(OWNER)}${addressWord(ROUTER)}`,
        },
        "latest",
      ],
      runtimeState,
      walletSession,
      setWalletSession,
    });

    expect(allowance).toEqual({
      handled: true,
      result: `0x${uintWord(100)}`,
    });
  });

  it("handles Uniswap V3 quote and swap-like transaction effects", () => {
    const runtimeState = baseRuntimeState();
    let walletSession = baseWalletSession();

    const setWalletSession = (session: Partial<LunaWalletSession>): LunaWalletSession => {
      walletSession = createLunaWalletSession({
        ...walletSession,
        ...session,
        accounts: session.accounts ?? walletSession.accounts,
        permissions: session.permissions ?? walletSession.permissions,
        assets: session.assets ?? walletSession.assets,
      });
      return walletSession;
    };

    const quote = resolveProtocolRequest({
      method: "eth_call",
      params: [
        {
          to: QUOTER,
          data: `0xf7729d43${addressWord(TOKEN_IN)}${addressWord(TOKEN_OUT)}${uintWord(3000)}${uintWord(2)}${uintWord(0)}`,
        },
        "latest",
      ],
      runtimeState,
      walletSession,
      setWalletSession,
    });

    expect(quote.handled).toBe(true);
    expect(decodeUint(quote.handled ? quote.result : "0x0")).toBe(3600n);

    setWalletSession({
      assets: {
        ...walletSession.assets,
        tokens: {
          ...walletSession.assets.tokens,
          [TOKEN_IN.toLowerCase()]: {
            ...walletSession.assets.tokens[TOKEN_IN.toLowerCase()],
            allowance: "10",
          },
        },
      },
    });

    const swap = resolveProtocolRequest({
      method: "eth_sendTransaction",
      params: [
        {
          from: OWNER,
          to: ROUTER,
          data: "0x414bf389",
        },
      ],
      runtimeState,
      walletSession,
      setWalletSession,
    });

    expect(swap.handled).toBe(true);
    expect(walletSession.assets.tokens[TOKEN_IN.toLowerCase()].balance).toBe("24");
    expect(walletSession.assets.tokens[TOKEN_OUT.toLowerCase()].balance).toBe("1800");

    const receipt = resolveProtocolRequest({
      method: "eth_getTransactionReceipt",
      params: [swap.handled ? swap.result : "0x0"],
      runtimeState,
      walletSession,
      setWalletSession,
    });

    expect(receipt).toMatchObject({
      handled: true,
      result: {
        status: "0x1",
        transactionHash: swap.handled ? swap.result : "0x0",
      },
    });
  });

  it("returns an empty log set for supported protocol log requests", () => {
    const runtimeState = baseRuntimeState();
    const walletSession = baseWalletSession();

    expect(
      resolveProtocolRequest({
        method: "eth_getLogs",
        params: [{}],
        runtimeState,
        walletSession,
        setWalletSession: () => walletSession,
      }),
    ).toEqual({
      handled: true,
      result: [],
    });
  });
});
