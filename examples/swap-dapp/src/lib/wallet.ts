import { getWalletSession } from "@lunatest/runtime-intercept";
import { BrowserProvider, JsonRpcProvider, formatUnits, type Provider } from "ethers";

export type ConnectedWallet = {
  kind: "real" | "luna";
  provider: BrowserProvider;
  transport: InjectedProvider;
  signerAddress: string;
  chainId: number;
};

type EthereumWindow = Window & {
  ethereum?: {
    request: (payload: { method: string; params?: unknown[] }) => Promise<unknown>;
  };
};

type InjectedProvider = NonNullable<EthereumWindow["ethereum"]>;

function isLunaWalletEnabled(): boolean {
  try {
    return getWalletSession().enabled;
  } catch {
    return false;
  }
}

export function isPlaceholderRpcUrl(rpcUrl: string): boolean {
  return rpcUrl.includes("<key>") || rpcUrl.includes("YOUR_") || rpcUrl.includes("your-");
}

export function getEthereumProvider(): InjectedProvider {
  const provider = (window as EthereumWindow).ethereum;
  if (!provider) {
    throw new Error("No injected wallet detected. Install MetaMask to continue.");
  }

  return provider;
}

export async function connectWallet(): Promise<ConnectedWallet> {
  const injected = getEthereumProvider();
  await injected.request({ method: "eth_requestAccounts" });

  const provider = new BrowserProvider(injected);
  const signer = await provider.getSigner();
  const signerAddress = await signer.getAddress();
  const network = await provider.getNetwork();

  return {
    kind: isLunaWalletEnabled() ? "luna" : "real",
    provider,
    transport: injected,
    signerAddress,
    chainId: Number(network.chainId),
  };
}

export function createReadProvider(rpcUrl: string): JsonRpcProvider {
  return new JsonRpcProvider(rpcUrl);
}

export async function readGasPriceGwei(provider: Provider): Promise<number> {
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas;
  if (!gasPrice) {
    return 0;
  }

  return Number(formatUnits(gasPrice, "gwei"));
}

export async function sendInjectedTransaction(
  provider: InjectedProvider,
  transaction: Record<string, unknown>,
): Promise<string> {
  const txHash = await provider.request({
    method: "eth_sendTransaction",
    params: [transaction],
  });

  if (typeof txHash !== "string") {
    throw new Error("Injected wallet did not return a transaction hash.");
  }

  return txHash;
}

export async function waitForInjectedReceipt(
  provider: InjectedProvider,
  txHash: string,
  maxWaitMs: number,
  pollIntervalMs: number,
): Promise<{ status: number; blockNumber?: number } | null> {
  const started = Date.now();

  while (Date.now() - started < maxWaitMs) {
    const receipt = await provider.request({
      method: "eth_getTransactionReceipt",
      params: [txHash],
    });

    if (receipt && typeof receipt === "object") {
      const normalized = receipt as { status?: string | number; blockNumber?: string | number };
      return {
        status:
          typeof normalized.status === "string"
            ? Number.parseInt(normalized.status, 16)
            : Number(normalized.status ?? 0),
        blockNumber:
          typeof normalized.blockNumber === "string"
            ? Number.parseInt(normalized.blockNumber, 16)
            : typeof normalized.blockNumber === "number"
              ? normalized.blockNumber
              : undefined,
      };
    }

    await new Promise((resolve) => {
      setTimeout(resolve, pollIntervalMs);
    });
  }

  return null;
}
