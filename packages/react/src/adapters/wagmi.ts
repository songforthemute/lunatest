import { type LunaProvider } from "@lunatest/core";

type Eip1193RequestLike = {
  method: string;
  params?: unknown[];
};

type WagmiLikeChain = {
  id: number;
};

type WagmiLikeTransport = {
  type: "luna";
  request: (payload: Eip1193RequestLike) => Promise<unknown>;
};

export type WagmiLikeConfig = {
  chains?: WagmiLikeChain[];
  transports?: Record<number, WagmiLikeTransport>;
};

export function withLunaWagmiConfig(
  config: WagmiLikeConfig,
  provider: LunaProvider,
): WagmiLikeConfig {
  const chainIds = (config.chains ?? [{ id: 1 }]).map((chain) => chain.id);
  const transports = { ...(config.transports ?? {}) };

  for (const chainId of chainIds) {
    transports[chainId] = {
      type: "luna",
      request: (payload: Eip1193RequestLike) => provider.request(payload),
    };
  }

  return {
    ...config,
    transports,
  };
}
