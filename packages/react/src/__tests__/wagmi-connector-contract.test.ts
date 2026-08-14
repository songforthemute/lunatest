import {
  connect,
  createConfig,
  disconnect,
  getConnection,
  sendTransaction,
  switchChain,
  waitForTransactionReceipt,
} from "@wagmi/core";
import { describe, expect, it, vi } from "vitest";
import { mainnet, sepolia } from "viem/chains";

import { LunaProvider } from "@lunatest/core";

import {
  createLunaWagmiConnector,
} from "../wagmi-connector";
import { createLunaWagmiTransport } from "../wagmi";

const account = "0x1111111111111111111111111111111111111111";
const recipient = "0x2222222222222222222222222222222222222222";

describe("wagmi connector contract", () => {
  it("manages connection state and wallet actions through LunaProvider", async () => {
    const provider = new LunaProvider({
      chainId: "0x1",
      wallet: {
        accounts: [account],
        connected: false,
      },
    });
    const connectorFactory = createLunaWagmiConnector(provider);
    const transport = createLunaWagmiTransport(provider);
    const config = createConfig({
      batch: { multicall: false },
      chains: [mainnet, sepolia],
      connectors: [connectorFactory],
      multiInjectedProviderDiscovery: false,
      storage: null,
      transports: {
        [mainnet.id]: transport,
        [sepolia.id]: transport,
      },
    });
    const connector = config.connectors[0];

    expect(await connector.isAuthorized()).toBe(false);
    await expect(connect(config, { connector })).resolves.toEqual({
      accounts: [account],
      chainId: mainnet.id,
    });
    expect(getConnection(config)).toMatchObject({
      address: account,
      chainId: mainnet.id,
      isConnected: true,
      status: "connected",
    });
    expect(await connector.isAuthorized()).toBe(true);

    await expect(switchChain(config, { chainId: sepolia.id })).resolves.toEqual(
      sepolia,
    );
    expect(getConnection(config).chainId).toBe(sepolia.id);

    const hash = await sendTransaction(config, {
      account,
      chainId: sepolia.id,
      gas: 21_000n,
      gasPrice: 1n,
      nonce: 0,
      to: recipient,
      value: 1n,
    });
    await expect(
      waitForTransactionReceipt(config, { chainId: sepolia.id, hash }),
    ).resolves.toMatchObject({
      status: "success",
      transactionHash: hash,
    });

    await disconnect(config);
    expect(getConnection(config)).toMatchObject({
      isDisconnected: true,
      status: "disconnected",
    });
    expect(await connector.isAuthorized()).toBe(false);

    await expect(
      connect(config, { connector, withCapabilities: true }),
    ).resolves.toEqual({
      accounts: [{ address: account, capabilities: {} }],
      chainId: sepolia.id,
    });
    expect(getConnection(config).isConnected).toBe(true);
    await disconnect(config);
    expect(getConnection(config).isDisconnected).toBe(true);
  });

  it("emits external changes once and suppresses action disconnect events", async () => {
    const provider = new LunaProvider({
      chainId: "0x1",
      wallet: {
        accounts: [account],
        connected: false,
      },
    });
    const connectorFactory = createLunaWagmiConnector(provider);
    const transport = createLunaWagmiTransport(provider);
    const config = createConfig({
      chains: [mainnet, sepolia],
      connectors: [connectorFactory],
      multiInjectedProviderDiscovery: false,
      storage: null,
      transports: {
        [mainnet.id]: transport,
        [sepolia.id]: transport,
      },
    });
    const connector = config.connectors[0];
    const emit = vi.spyOn(connector.emitter, "emit");

    await connect(config, { connector });
    emit.mockClear();
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0xaa36a7" }],
    });
    expect(emit.mock.calls.filter(([event]) => event === "change")).toHaveLength(1);
    expect(getConnection(config).chainId).toBe(sepolia.id);

    emit.mockClear();
    await provider.request({
      method: "wallet_revokePermissions",
      params: [{ eth_accounts: {} }],
    });
    expect(emit.mock.calls.filter(([event]) => event === "disconnect")).toHaveLength(1);
    expect(getConnection(config).isDisconnected).toBe(true);

    await connect(config, { connector });
    emit.mockClear();
    await disconnect(config);
    expect(emit.mock.calls.filter(([event]) => event === "disconnect")).toHaveLength(0);
    expect(getConnection(config).isDisconnected).toBe(true);

    emit.mockClear();
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x1" }],
    });
    expect(emit).not.toHaveBeenCalled();
  });

  it("rejects an unsupported chain before authorizing accounts", async () => {
    const provider = new LunaProvider({
      chainId: "0x1",
      wallet: {
        accounts: [account],
        connected: false,
      },
    });
    const config = createConfig({
      chains: [mainnet],
      connectors: [createLunaWagmiConnector(provider)],
      multiInjectedProviderDiscovery: false,
      storage: null,
      transports: {
        [mainnet.id]: createLunaWagmiTransport(provider),
      },
    });
    const connector = config.connectors[0];

    await expect(connector.connect({ chainId: 999 })).rejects.toThrow(
      /Chain not configured/,
    );
    await expect(
      provider.request({ method: "eth_accounts" }),
    ).resolves.toEqual([]);
    expect(await connector.isAuthorized()).toBe(false);
    expect(getConnection(config).isDisconnected).toBe(true);
  });
});
