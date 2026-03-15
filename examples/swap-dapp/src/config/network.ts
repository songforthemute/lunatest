export const SEPOLIA_CHAIN_ID = 11155111;

export type SwapEnvConfig = {
  sepoliaRpcUrl: string;
  factory: `0x${string}`;
  router: `0x${string}`;
  quoterV2: `0x${string}`;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  poolFee: number;
};

type EnvLike = Record<string, string | undefined>;

type LoadResult =
  | { ok: true; value: SwapEnvConfig }
  | { ok: false; error: string; missing: string[] };

function isAddress(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function parseRequired(env: EnvLike, key: string, missing: string[]): string {
  const value = env[key]?.trim();
  if (!value) {
    missing.push(key);
    return "";
  }

  return value;
}

export function loadSwapEnvConfig(env: EnvLike): LoadResult {
  const missing: string[] = [];

  const sepoliaRpcUrl = parseRequired(env, "VITE_SEPOLIA_RPC_URL", missing);
  const factory = parseRequired(env, "VITE_UNISWAP_V3_FACTORY", missing);
  const router = parseRequired(env, "VITE_UNISWAP_V3_ROUTER", missing);
  const quoterV2 = parseRequired(env, "VITE_UNISWAP_V3_QUOTER_V2", missing);
  const tokenIn = parseRequired(env, "VITE_TOKEN_IN", missing);
  const tokenOut = parseRequired(env, "VITE_TOKEN_OUT", missing);
  const poolFeeRaw = parseRequired(env, "VITE_POOL_FEE", missing);

  if (missing.length > 0) {
    return {
      ok: false,
      missing,
      error: `Missing required env: ${missing.join(", ")}`,
    };
  }

  if (!isAddress(factory) || !isAddress(router) || !isAddress(quoterV2)) {
    return {
      ok: false,
      missing: [],
      error: "Uniswap contract env values must be valid 0x addresses",
    };
  }

  if (!isAddress(tokenIn) || !isAddress(tokenOut)) {
    return {
      ok: false,
      missing: [],
      error: "Token env values must be valid 0x addresses",
    };
  }

  const poolFee = Number(poolFeeRaw);
  if (!Number.isFinite(poolFee) || poolFee <= 0) {
    return {
      ok: false,
      missing: [],
      error: "VITE_POOL_FEE must be a positive number",
    };
  }

  return {
    ok: true,
    value: {
      sepoliaRpcUrl,
      factory,
      router,
      quoterV2,
      tokenIn,
      tokenOut,
      poolFee,
    },
  };
}
