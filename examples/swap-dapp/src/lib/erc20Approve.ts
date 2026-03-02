import { Contract, MaxUint256, type BrowserProvider, type JsonRpcSigner } from "ethers";
import { ERC20_ABI } from "../config/uniswap";

export async function readTokenSymbol(
  provider: BrowserProvider,
  tokenAddress: string,
): Promise<string> {
  try {
    const contract = new Contract(tokenAddress, ERC20_ABI, provider);
    const symbol = await contract.symbol();
    return typeof symbol === "string" ? symbol : tokenAddress.slice(0, 6);
  } catch {
    return tokenAddress.slice(0, 6);
  }
}

export async function readTokenDecimals(
  provider: BrowserProvider,
  tokenAddress: string,
): Promise<number> {
  try {
    const contract = new Contract(tokenAddress, ERC20_ABI, provider);
    const decimals = await contract.decimals();
    return Number(decimals);
  } catch {
    return 18;
  }
}

export async function readTokenBalance(
  provider: BrowserProvider,
  tokenAddress: string,
  owner: string,
): Promise<bigint> {
  const contract = new Contract(tokenAddress, ERC20_ABI, provider);
  return (await contract.balanceOf(owner)) as bigint;
}

export async function readAllowance(
  provider: BrowserProvider,
  tokenAddress: string,
  owner: string,
  spender: string,
): Promise<bigint> {
  const contract = new Contract(tokenAddress, ERC20_ABI, provider);
  return (await contract.allowance(owner, spender)) as bigint;
}

export async function approveMax(
  signer: JsonRpcSigner,
  tokenAddress: string,
  spender: string,
): Promise<string> {
  const contract = new Contract(tokenAddress, ERC20_ABI, signer);
  const tx = await contract.approve(spender, MaxUint256);
  return tx.hash as string;
}
