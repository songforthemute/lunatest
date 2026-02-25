import { type LunaProvider } from "@lunatest/core";

export type EthersLikeProvider = {
  send: (method: string, params?: unknown[]) => Promise<unknown>;
};

export function createEthersAdapter(provider: LunaProvider): EthersLikeProvider {
  return {
    send(method: string, params: unknown[] = []) {
      return provider.request({
        method,
        params,
      });
    },
  };
}
