import { Contract, type JsonRpcSigner, type Provider } from "ethers";
import { UNISWAP_SWAP_ROUTER_ABI } from "../config/uniswap";

type SwapInput = {
  routerAddress: string;
  tokenIn: string;
  tokenOut: string;
  fee: number;
  recipient: string;
  amountIn: bigint;
  amountOutMinimum: bigint;
};

export async function submitSwap(
  signer: JsonRpcSigner,
  input: SwapInput,
): Promise<string> {
  const router = new Contract(input.routerAddress, UNISWAP_SWAP_ROUTER_ABI, signer);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);

  const tx = await router.exactInputSingle({
    tokenIn: input.tokenIn,
    tokenOut: input.tokenOut,
    fee: input.fee,
    recipient: input.recipient,
    deadline,
    amountIn: input.amountIn,
    amountOutMinimum: input.amountOutMinimum,
    sqrtPriceLimitX96: 0n,
  });

  return tx.hash as string;
}

export async function waitForReceipt(
  provider: Provider,
  txHash: string,
  maxWaitMs: number,
  pollIntervalMs: number,
): Promise<{ status: number; blockNumber: number } | null> {
  const started = Date.now();

  while (Date.now() - started < maxWaitMs) {
    const receipt = await provider.getTransactionReceipt(txHash);
    if (receipt) {
      return {
        status: Number(receipt.status ?? 0),
        blockNumber: Number(receipt.blockNumber),
      };
    }

    await new Promise((resolve) => {
      setTimeout(resolve, pollIntervalMs);
    });
  }

  return null;
}
