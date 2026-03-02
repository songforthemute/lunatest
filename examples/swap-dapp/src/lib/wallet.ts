import { BrowserProvider, formatUnits } from "ethers";

export type ConnectedWallet = {
  provider: BrowserProvider;
  signerAddress: string;
  chainId: number;
};

type EthereumWindow = Window & {
  ethereum?: {
    request: (payload: { method: string; params?: unknown[] }) => Promise<unknown>;
  };
};

type InjectedProvider = NonNullable<EthereumWindow["ethereum"]>;

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
    provider,
    signerAddress,
    chainId: Number(network.chainId),
  };
}

export async function readGasPriceGwei(provider: BrowserProvider): Promise<number> {
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas;
  if (!gasPrice) {
    return 0;
  }

  return Number(formatUnits(gasPrice, "gwei"));
}
