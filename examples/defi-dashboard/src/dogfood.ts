import {
  applyInterceptState,
  connectWalletSession,
  disableLunaRuntimeIntercept,
  enableLunaRuntimeIntercept,
  getWalletSession,
  setRouteMocks,
  setWalletSession,
} from "@lunatest/runtime-intercept";

type EthereumProvider = {
  request: (payload: { method: string; params?: unknown }) => Promise<unknown>;
};

type ProtocolPresetMaterialization = {
  protocolPresetId: string;
  walletPresetId: string;
  resolvedParams: Record<string, unknown>;
  walletSession: Parameters<typeof setWalletSession>[0];
  interceptState: Record<string, unknown>;
  routeMocks: Parameters<typeof setRouteMocks>[0];
};

export type ProtocolDogfoodCard = {
  id: "uniswap_v2" | "uniswap_v3" | "curve" | "aave";
  label: string;
  supportLevel: string;
  primaryMetric: string;
  quoteOut: string;
  healthFactor?: string;
  receiptStatus: "0x1" | "0x0" | "pending";
  note: string;
};

export type DefiDashboardSnapshot = {
  generatedAt: string;
  wallet: {
    account: string;
    chainId: string;
    nativeBalance: string;
  };
  protocols: ProtocolDogfoodCard[];
};

const DEFAULT_ACCOUNT = "0x1111111111111111111111111111111111111111";

function stripHexPrefix(value: string): string {
  return value.replace(/^0x/i, "");
}

function uintWord(value: string | number | bigint): string {
  return BigInt(value).toString(16).padStart(64, "0");
}

function addressWord(address: string): string {
  return stripHexPrefix(address).slice(-40).padStart(64, "0").toLowerCase();
}

function decodeUint(value: unknown): bigint {
  if (typeof value !== "string" || !/^0x[0-9a-f]+$/i.test(value)) {
    return 0n;
  }

  return BigInt(value);
}

function decodeUintArrayTail(value: unknown): bigint {
  if (typeof value !== "string" || !/^0x[0-9a-f]+$/i.test(value)) {
    return 0n;
  }

  const raw = stripHexPrefix(value);
  const tail = raw.slice(-64);
  return tail ? BigInt(`0x${tail}`) : 0n;
}

function provider(): EthereumProvider {
  const ethereum = (globalThis.window as { ethereum?: EthereumProvider } | undefined)?.ethereum;
  if (!ethereum) {
    throw new Error("Luna runtime did not install window.ethereum");
  }
  return ethereum;
}

function protocolRuntime(materialized: ProtocolPresetMaterialization): Record<string, unknown> {
  const candidate = materialized.interceptState.protocolRuntime;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new Error(`${materialized.protocolPresetId} did not materialize protocolRuntime`);
  }
  return candidate as Record<string, unknown>;
}

function contracts(materialized: ProtocolPresetMaterialization): Record<string, string> {
  const runtime = protocolRuntime(materialized);
  const candidate = runtime.contracts;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new Error(`${materialized.protocolPresetId} did not materialize contracts`);
  }
  return candidate as Record<string, string>;
}

async function installProtocol(id: ProtocolDogfoodCard["id"]): Promise<ProtocolPresetMaterialization> {
  disableLunaRuntimeIntercept();
  const { createPresetRegistry, materializeProtocolPreset } = await import("@lunatest/core/browser");
  const registry = createPresetRegistry();
  const materialized = await materializeProtocolPreset(id, {}, registry);

  enableLunaRuntimeIntercept({
    enable: true,
    intercept: {
      mode: "strict",
    },
  }, "development");
  setRouteMocks(materialized.routeMocks);
  applyInterceptState(materialized.interceptState);
  setWalletSession(materialized.walletSession);
  connectWalletSession(DEFAULT_ACCOUNT);

  return materialized;
}

async function approve(token: string, spender: string, amount: bigint): Promise<void> {
  await provider().request({
    method: "eth_sendTransaction",
    params: [
      {
        from: DEFAULT_ACCOUNT,
        to: token,
        data: `0x095ea7b3${addressWord(spender)}${uintWord(amount)}`,
      },
    ],
  });
}

async function receiptStatus(txHash: unknown): Promise<ProtocolDogfoodCard["receiptStatus"]> {
  const receipt = await provider().request({
    method: "eth_getTransactionReceipt",
    params: [txHash],
  });

  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    return "pending";
  }

  return (receipt as { status?: "0x1" | "0x0" }).status ?? "pending";
}

async function runUniswapV2(): Promise<ProtocolDogfoodCard> {
  const materialized = await installProtocol("uniswap_v2");
  const runtimeContracts = contracts(materialized);
  const tokenIn = String(materialized.resolvedParams.tokenIn);
  const tokenOut = String(materialized.resolvedParams.tokenOut);
  const amountIn = 1n;

  const quote = await provider().request({
    method: "eth_call",
    params: [
      {
        to: runtimeContracts.router,
        data: `0xd06ca61f${uintWord(amountIn)}`,
      },
      "latest",
    ],
  });
  await approve(tokenIn, runtimeContracts.router, amountIn);
  const txHash = await provider().request({
    method: "eth_sendTransaction",
    params: [
      {
        from: DEFAULT_ACCOUNT,
        to: runtimeContracts.router,
        data: `0x38ed1739${uintWord(amountIn)}${uintWord(0)}${addressWord(tokenIn)}${addressWord(tokenOut)}`,
      },
    ],
  });

  return {
    id: "uniswap_v2",
    label: "Uniswap V2",
    supportLevel: String(protocolRuntime(materialized).supportLevel ?? "L3"),
    primaryMetric: "Pair quote",
    quoteOut: decodeUintArrayTail(quote).toString(10),
    receiptStatus: await receiptStatus(txHash),
    note: "Router quote and swap-style transaction mutate wallet balances deterministically.",
  };
}

async function runUniswapV3(): Promise<ProtocolDogfoodCard> {
  const materialized = await installProtocol("uniswap_v3");
  const runtimeContracts = contracts(materialized);
  const tokenIn = String(materialized.resolvedParams.tokenIn);
  const tokenOut = String(materialized.resolvedParams.tokenOut);
  const feeTier = BigInt(String(materialized.resolvedParams.feeTier ?? 3000));
  const amountIn = 1n;

  const quote = await provider().request({
    method: "eth_call",
    params: [
      {
        to: runtimeContracts.quoter,
        data: `0xc6a5026a${addressWord(tokenIn)}${addressWord(tokenOut)}${uintWord(amountIn)}${uintWord(feeTier)}${uintWord(0)}`,
      },
      "latest",
    ],
  });
  await approve(tokenIn, runtimeContracts.router, amountIn);
  const txHash = await provider().request({
    method: "eth_sendTransaction",
    params: [
      {
        from: DEFAULT_ACCOUNT,
        to: runtimeContracts.router,
        data: `0x414bf389${addressWord(tokenIn)}${addressWord(tokenOut)}${uintWord(feeTier)}${addressWord(DEFAULT_ACCOUNT)}${uintWord(999999)}${uintWord(amountIn)}${uintWord(0)}${uintWord(0)}`,
      },
    ],
  });

  return {
    id: "uniswap_v3",
    label: "Uniswap V3",
    supportLevel: String(protocolRuntime(materialized).supportLevel ?? "L3"),
    primaryMetric: "Quoter V2",
    quoteOut: decodeUint(quote).toString(10),
    receiptStatus: await receiptStatus(txHash),
    note: "Quoter and exactInputSingle paths run through the same injected provider.",
  };
}

async function runCurve(): Promise<ProtocolDogfoodCard> {
  const materialized = await installProtocol("curve");
  const runtimeContracts = contracts(materialized);
  const runtime = protocolRuntime(materialized) as {
    curve?: { pools?: Array<{ coins?: string[] }> };
  };
  const [tokenIn, tokenOut] = runtime.curve?.pools?.[0]?.coins ?? [];
  const amountIn = 1000n;

  const quote = await provider().request({
    method: "eth_call",
    params: [
      {
        to: runtimeContracts.pool,
        data: `0x5e0d443f${uintWord(0)}${uintWord(1)}${uintWord(amountIn)}`,
      },
      "latest",
    ],
  });
  await approve(tokenIn, runtimeContracts.pool, amountIn);
  const txHash = await provider().request({
    method: "eth_sendTransaction",
    params: [
      {
        from: DEFAULT_ACCOUNT,
        to: runtimeContracts.pool,
        data: `0x3df02124${uintWord(0)}${uintWord(1)}${uintWord(amountIn)}${uintWord(0)}`,
      },
    ],
  });

  return {
    id: "curve",
    label: "Curve",
    supportLevel: String(protocolRuntime(materialized).supportLevel ?? "L3"),
    primaryMetric: "Stable-swap quote",
    quoteOut: decodeUint(quote).toString(10),
    receiptStatus: await receiptStatus(txHash),
    note: `Pool coin route ${shortAddress(tokenIn)} → ${shortAddress(tokenOut)} stays deterministic.`,
  };
}

async function runAave(): Promise<ProtocolDogfoodCard> {
  const materialized = await installProtocol("aave");
  const runtimeContracts = contracts(materialized);
  const runtime = protocolRuntime(materialized) as {
    aave?: { reserves?: Array<{ asset?: string }> };
  };
  const reserve = runtime.aave?.reserves?.[0]?.asset ?? "";
  const amount = 1n;

  const accountData = await provider().request({
    method: "eth_call",
    params: [
      {
        to: runtimeContracts.pool,
        data: "0xbf92857c",
      },
      "latest",
    ],
  });
  const txHash = await provider().request({
    method: "eth_sendTransaction",
    params: [
      {
        from: DEFAULT_ACCOUNT,
        to: runtimeContracts.pool,
        data: `0x617ba037${addressWord(reserve)}${uintWord(amount)}${addressWord(DEFAULT_ACCOUNT)}${uintWord(0)}`,
      },
    ],
  });

  return {
    id: "aave",
    label: "Aave",
    supportLevel: String(protocolRuntime(materialized).supportLevel ?? "L3"),
    primaryMetric: "Health factor",
    quoteOut: "900",
    healthFactor: formatHealthFactor(decodeAaveHealthFactor(accountData).toString(10)),
    receiptStatus: await receiptStatus(txHash),
    note: "Reserve/account reads and supply-style transactions use seeded wallet assets.",
  };
}

function decodeAaveHealthFactor(value: unknown): bigint {
  if (typeof value !== "string" || !/^0x[0-9a-f]+$/i.test(value)) {
    return 0n;
  }

  const raw = stripHexPrefix(value);
  const words = raw.match(/.{1,64}/g) ?? [];
  const healthFactor = (words[5] ?? "0").replace(/^0+/, "") || "0";
  if (/^[0-9]+$/.test(healthFactor) && healthFactor.length > 18) {
    return BigInt(healthFactor);
  }
  return BigInt(`0x${healthFactor}`);
}

export function formatBaseUnit(value: string, decimals: number): string {
  const raw = BigInt(value);
  const scale = 10n ** BigInt(decimals);
  const whole = raw / scale;
  const fraction = ((raw % scale) * 100n) / scale;
  return `${whole.toString(10)}.${fraction.toString(10).padStart(2, "0")}`;
}

export function formatHealthFactor(value: string): string {
  return formatBaseUnit(value, 18);
}

export function shortAddress(address: string): string {
  if (!address || address.length < 12) {
    return address;
  }
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export async function createDefiDashboardSnapshot(): Promise<DefiDashboardSnapshot> {
  const protocols = [
    await runUniswapV2(),
    await runUniswapV3(),
    await runCurve(),
    await runAave(),
  ];
  const walletSession = getWalletSession();
  disableLunaRuntimeIntercept();

  return {
    generatedAt: new Date().toISOString(),
    wallet: {
      account: walletSession.accounts[0] ?? DEFAULT_ACCOUNT,
      chainId: walletSession.chainId,
      nativeBalance: formatBaseUnit(walletSession.assets.nativeBalance, 18),
    },
    protocols,
  };
}
