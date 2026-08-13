import { createConfig, getBalance } from "@wagmi/core";
import { describe, expect, it } from "vitest";
import { createPublicClient, createWalletClient } from "viem";
import { mainnet } from "viem/chains";

import { LunaProvider } from "@lunatest/core";

import { createLunaWagmiTransport } from "../wagmi";

const account = "0x1111111111111111111111111111111111111111";
const recipient = "0x2222222222222222222222222222222222222222";

describe("wagmi/viem transport contract", () => {
  it("routes real clients through the Luna provider", async () => {
    const provider = new LunaProvider({
      chainId: "0x1",
      accounts: [account],
      balances: {
        [account]: "0xde0b6b3a7640000",
      },
    });
    const transport = createLunaWagmiTransport(provider);
    const config = createConfig({
      batch: { multicall: false },
      chains: [mainnet],
      multiInjectedProviderDiscovery: false,
      transports: {
        [mainnet.id]: transport,
      },
    });
    const publicClient = config.getClient({ chainId: mainnet.id });
    const walletClient = createWalletClient({
      chain: mainnet,
      transport,
    });
    const receiptClient = createPublicClient({
      chain: mainnet,
      pollingInterval: 1,
      transport,
    });

    await expect(
      publicClient.request({ method: "eth_chainId" }),
    ).resolves.toBe("0x1");
    await expect(
      getBalance(config, { address: account, chainId: mainnet.id }),
    ).resolves.toEqual({
      decimals: 18,
      symbol: "ETH",
      value: 1_000_000_000_000_000_000n,
    });
    await expect(walletClient.requestAddresses()).resolves.toEqual([account]);

    const hash = await walletClient.sendTransaction({
      account,
      gas: 21_000n,
      gasPrice: 1n,
      nonce: 0,
      to: recipient,
      value: 1n,
    });

    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
    await expect(
      receiptClient.waitForTransactionReceipt({ hash, timeout: 100 }),
    ).resolves.toMatchObject({
      blockNumber: 1n,
      status: "success",
      transactionHash: hash,
    });
  });
});
