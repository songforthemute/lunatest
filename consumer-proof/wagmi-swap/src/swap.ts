import {
  connect,
  readContract,
  waitForTransactionReceipt,
  writeContract,
  type Config,
} from "@wagmi/core";
import { parseAbi, type Address, type Hash } from "viem";
import { sepolia } from "viem/chains";

export const OWNER = "0x1111111111111111111111111111111111111111" as const;
export const TOKEN_IN = "0xfff9976782d46cc05630d1f6ebab18b2324d6b14" as const;
export const TOKEN_OUT = "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238" as const;
export const ROUTER = "0xe592427a0aece92de3edee1f18e0157c05861564" as const;
export const QUOTER = "0x61ffe014ba17989e743c5f6cb21bf9697530b21e" as const;
export const AMOUNT_IN = 1n;
export const APPROVAL_AMOUNT = 1n;
export const FEE_TIER = 3000;

const erc20Abi = parseAbi([
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
]);

const quoterAbi = parseAbi([
  "function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) view returns (uint256 amountOut)",
]);

const routerAbi = parseAbi([
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut)",
]);

export type Portfolio = {
  allowance: bigint;
  inputBalance: bigint;
  outputBalance: bigint;
};

export async function connectWallet(config: Config): Promise<Address> {
  const connector = config.connectors[0];
  if (!connector) {
    throw new Error("Wallet connector is missing");
  }

  const connection = await connect(config, { connector });
  const account = connection.accounts[0];
  if (!account) {
    throw new Error("Wallet returned no account");
  }
  return account;
}

export async function readQuote(config: Config): Promise<bigint> {
  return readContract(config, {
    abi: quoterAbi,
    address: QUOTER,
    args: [TOKEN_IN, TOKEN_OUT, FEE_TIER, AMOUNT_IN, 0n],
    chainId: sepolia.id,
    functionName: "quoteExactInputSingle",
  });
}

async function waitForSuccess(
  config: Config,
  hash: Hash,
): Promise<void> {
  const receipt = await waitForTransactionReceipt(config, {
    chainId: sepolia.id,
    hash,
  });
  if (receipt.status !== "success") {
    throw new Error(`Transaction reverted: ${hash}`);
  }
}

export async function approveSwap(
  config: Config,
  account: Address,
): Promise<Hash> {
  const hash = await writeContract(config, {
    abi: erc20Abi,
    account,
    address: TOKEN_IN,
    args: [ROUTER, APPROVAL_AMOUNT],
    chainId: sepolia.id,
    functionName: "approve",
  });
  await waitForSuccess(config, hash);
  return hash;
}

export async function submitSwap(
  config: Config,
  account: Address,
): Promise<Hash> {
  const hash = await writeContract(config, {
    abi: routerAbi,
    account,
    address: ROUTER,
    args: [
      {
        amountIn: AMOUNT_IN,
        amountOutMinimum: 0n,
        deadline: 999_999n,
        fee: FEE_TIER,
        recipient: account,
        sqrtPriceLimitX96: 0n,
        tokenIn: TOKEN_IN,
        tokenOut: TOKEN_OUT,
      },
    ],
    chainId: sepolia.id,
    functionName: "exactInputSingle",
  });
  await waitForSuccess(config, hash);
  return hash;
}

export async function readPortfolio(
  config: Config,
  account: Address = OWNER,
): Promise<Portfolio> {
  const [allowance, inputBalance, outputBalance] = await Promise.all([
    readContract(config, {
      abi: erc20Abi,
      address: TOKEN_IN,
      args: [account, ROUTER],
      chainId: sepolia.id,
      functionName: "allowance",
    }),
    readContract(config, {
      abi: erc20Abi,
      address: TOKEN_IN,
      args: [account],
      chainId: sepolia.id,
      functionName: "balanceOf",
    }),
    readContract(config, {
      abi: erc20Abi,
      address: TOKEN_OUT,
      args: [account],
      chainId: sepolia.id,
      functionName: "balanceOf",
    }),
  ]);

  return { allowance, inputBalance, outputBalance };
}
