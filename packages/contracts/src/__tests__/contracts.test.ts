import { describe, expect, it } from "vitest";

import {
  asRecord,
  createLunaWalletSession,
  createLunaWalletAssetState,
  deepMerge,
  extractPermissionKeys,
  getLunaWalletTokenAsset,
  isRecord,
  normalizeAddress,
  normalizeWalletPermissions,
} from "../index.js";

describe("contracts utils", () => {
  it("deep merges nested records", () => {
    const merged = deepMerge(
      {
        chain: {
          id: 1,
        },
      },
      {
        chain: {
          gasPrice: 30,
        },
      },
    );

    expect(merged).toEqual({
      chain: {
        id: 1,
        gasPrice: 30,
      },
    });
  });

  it("checks record values", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(asRecord({ value: 1 })).toEqual({ value: 1 });
  });

  it("normalizes wallet permissions and deduplicates them", () => {
    expect(
      normalizeWalletPermissions([
        "eth_accounts",
        { parentCapability: "eth_accounts" },
        { parentCapability: "wallet_requestPermissions" },
      ]),
    ).toEqual([
      { parentCapability: "eth_accounts" },
      { parentCapability: "wallet_requestPermissions" },
    ]);
  });

  it("creates default luna wallet session", () => {
    expect(
      createLunaWalletSession({
        connected: true,
        chainId: "0xaa36a7",
      }),
    ).toMatchObject({
      enabled: false,
      connected: true,
      chainId: "0xaa36a7",
      accounts: ["0x1111111111111111111111111111111111111111"],
      permissions: [{ parentCapability: "eth_accounts" }],
      assets: {
        nativeBalance: "0",
        tokens: {},
      },
    });
  });

  it("extracts wallet permission keys from request params", () => {
    expect(
      extractPermissionKeys([{ eth_accounts: {}, wallet_requestPermissions: {} }]),
    ).toEqual(["eth_accounts", "wallet_requestPermissions"]);
  });

  it("normalizes wallet asset state by address", () => {
    const assets = createLunaWalletAssetState({
      nativeBalance: "1",
      tokens: {
        "0xABC": {
          balance: "25",
          allowance: "0",
        },
      },
    });

    expect(getLunaWalletTokenAsset(assets, "0xabc")).toEqual({
      balance: "25",
      allowance: "0",
      decimals: undefined,
      symbol: undefined,
    });
    expect(normalizeAddress("0xABC")).toBe("0xabc");
  });
});
