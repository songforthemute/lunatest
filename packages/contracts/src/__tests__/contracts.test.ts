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
  parseProtocolPresetManifest,
  parseWalletPresetManifest,
  qualifyPresetId,
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

  it("parses protocol preset manifest", () => {
    expect(
      parseProtocolPresetManifest({
        id: "uniswap_v3",
        label: "Uniswap V3",
        kind: "dex",
        supportedChains: [1, 11155111],
        protocol: "uniswap",
        version: "v3",
        components: {
          quoter: "v2",
          router: "swap_router_02",
        },
        defaultWalletPreset: {
          id: "demo_sepolia",
        },
        defaultInterceptState: {
          chain: { id: 11155111 },
        },
        defaultRouteMocks: [],
        builtinScenarios: [
          {
            id: "approval_required",
            label: "Approval Required",
            lua: "scenario { name = 'approval_required' }",
          },
        ],
        paramsSchema: [
          {
            key: "chainId",
            label: "Chain",
            type: "chainId",
            default: 11155111,
          },
        ],
        recommendedControls: ["chainId"],
      }),
    ).toMatchObject({
      id: "uniswap_v3",
      components: {
        quoter: "v2",
      },
    });
  });

  it("parses wallet preset manifest", () => {
    expect(
      parseWalletPresetManifest({
        id: "demo_sepolia",
        label: "Demo Sepolia Wallet",
        kind: "wallet",
        supportedChains: [11155111],
        defaultSession: {
          chainId: "0xaa36a7",
        },
        recommendedControls: ["address"],
      }),
    ).toMatchObject({
      id: "demo_sepolia",
      kind: "wallet",
      supportedChains: [11155111],
    });
  });

  it("qualifies preset ids with source namespace", () => {
    expect(qualifyPresetId("builtin", "uniswap_v3")).toBe("builtin/uniswap_v3");
    expect(qualifyPresetId("project", "team/foo")).toBe("project/team/foo");
  });
});
