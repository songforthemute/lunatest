import { describe, expect, it } from "vitest";

import {
  getProtocolPreset,
  getWalletPreset,
  listProtocolPresets,
  listWalletPresets,
  materializeProtocolPreset,
  materializeWalletPreset,
} from "../registry";

describe("preset registry", () => {
  it("lists built-in protocol and wallet presets", async () => {
    const [protocols, wallets] = await Promise.all([
      listProtocolPresets(),
      listWalletPresets(),
    ]);

    expect(protocols.map((item) => item.id)).toEqual(
      expect.arrayContaining(["uniswap_v2", "uniswap_v3", "curve", "aave"]),
    );
    expect(wallets.map((item) => item.id)).toEqual(
      expect.arrayContaining(["empty_wallet", "demo_sepolia"]),
    );
  });

  it("loads protocol and wallet preset metadata by id", async () => {
    await expect(getProtocolPreset("uniswap_v3")).resolves.toMatchObject({
      id: "uniswap_v3",
      components: {
        quoter: "v2",
      },
    });

    await expect(getWalletPreset("demo_sepolia")).resolves.toMatchObject({
      id: "demo_sepolia",
      kind: "wallet",
    });
  });

  it("materializes wallet preset deterministically", async () => {
    const first = await materializeWalletPreset("demo_sepolia", {
      address: "0x1111111111111111111111111111111111111111",
      chainId: 11155111,
    });
    const second = await materializeWalletPreset("demo_sepolia", {
      address: "0x1111111111111111111111111111111111111111",
      chainId: 11155111,
    });

    expect(first).toEqual(second);
  });

  it("materializes uniswap v3 with component override", async () => {
    const v1 = await materializeProtocolPreset("uniswap_v3", {
      chainId: 11155111,
      quoter: "v1",
    });
    const v2 = await materializeProtocolPreset("uniswap_v3", {
      chainId: 11155111,
      quoter: "v2",
    });

    expect(v1.interceptState).not.toEqual(v2.interceptState);
    expect(v1.walletPresetId).toBe("demo_sepolia");
  });

  it("rejects unsupported protocol chain", async () => {
    await expect(
      materializeProtocolPreset("curve", {
        chainId: 11155111,
      }),
    ).rejects.toThrow(/does not support chain/);
  });
});
