import { describe, expect, it } from "vitest";

import {
  createPresetRegistry,
  getProtocolPreset,
  getWalletPreset,
  listProtocolPresets,
  listWalletPresets,
  loadProjectPresetSources,
  materializeProtocolPreset,
  materializeWalletPreset,
} from "../registry";
import { writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("preset registry", () => {
  it("lists built-in protocol and wallet presets", async () => {
    const [protocols, wallets] = await Promise.all([
      listProtocolPresets(),
      listWalletPresets(),
    ]);

    expect(protocols.map((item) => item.qualifiedId)).toEqual(
      expect.arrayContaining([
        "builtin/uniswap_v2",
        "builtin/uniswap_v3",
        "builtin/curve",
        "builtin/aave",
      ]),
    );
    expect(wallets.map((item) => item.qualifiedId)).toEqual(
      expect.arrayContaining(["builtin/empty_wallet", "builtin/demo_sepolia"]),
    );
  });

  it("loads protocol and wallet preset metadata by id", async () => {
    await expect(getProtocolPreset("uniswap_v3")).resolves.toMatchObject({
      id: "uniswap_v3",
      qualifiedId: "builtin/uniswap_v3",
      components: {
        quoter: "v2",
      },
    });

    await expect(getWalletPreset("demo_sepolia")).resolves.toMatchObject({
      id: "demo_sepolia",
      qualifiedId: "builtin/demo_sepolia",
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
    expect(v1.walletPresetId).toBe("builtin/demo_sepolia");
  });

  it("rejects unsupported protocol chain", async () => {
    await expect(
      materializeProtocolPreset("curve", {
        chainId: 11155111,
      }),
    ).rejects.toThrow(/does not support chain/);
  });

  it("discovers project-local preset sources with namespace separation", async () => {
    const tempRoot = await fsMkdtemp();
    await mkdir(path.join(tempRoot, "lunatest/presets/protocol"), { recursive: true });
    await mkdir(path.join(tempRoot, "lunatest/presets/wallet"), { recursive: true });

    await writeFile(
      path.join(tempRoot, "lunatest/presets/protocol/team_swap.lua"),
      `return {
        manifest = {
          id = "team_swap",
          label = "Team Swap",
          kind = "dex",
          supportedChains = { 11155111 },
          protocol = "teamdex",
          version = "v1",
          components = { quoter = "local" },
          defaultWalletPreset = { id = "project/team_wallet" },
          defaultInterceptState = {},
          defaultRouteMocks = {},
          builtinScenarios = {},
          paramsSchema = {},
          recommendedControls = {},
        },
        materialize = function()
          return {
            walletPreset = { id = "project/team_wallet" },
            interceptState = { protocol = { id = "team_swap" } },
          }
        end,
      }`,
    );

    await writeFile(
      path.join(tempRoot, "lunatest/presets/wallet/team_wallet.lua"),
      `return {
        manifest = {
          id = "team_wallet",
          label = "Team Wallet",
          kind = "wallet",
          supportedChains = { 11155111 },
          defaultSession = {
            chainId = "0xaa36a7",
            accounts = { "0x1111111111111111111111111111111111111111" },
            permissions = {},
            assets = { nativeBalance = "1", tokens = {} },
          },
        },
        materialize = function()
          return {}
        end,
      }`,
    );

    const projectSources = await loadProjectPresetSources(tempRoot);
    const registry = createPresetRegistry({ projectSources });
    const protocols = await listProtocolPresets(registry);
    const wallets = await listWalletPresets(registry);

    expect(protocols.map((item) => item.qualifiedId)).toEqual(
      expect.arrayContaining(["project/team_swap", "builtin/uniswap_v3"]),
    );
    expect(wallets.map((item) => item.qualifiedId)).toEqual(
      expect.arrayContaining(["project/team_wallet", "builtin/demo_sepolia"]),
    );
  });
});

async function fsMkdtemp(): Promise<string> {
  const { mkdtemp } = await import("node:fs/promises");
  return mkdtemp(path.join(os.tmpdir(), "lunatest-preset-registry-"));
}
