import { type LunaProvider } from "@lunatest/core";

type RequestPayload = {
  method: string;
  params?: unknown[];
};

export type Web3JsLikeProvider = {
  request: (payload: RequestPayload) => Promise<unknown>;
};

export function createWeb3JsAdapter(provider: LunaProvider): Web3JsLikeProvider {
  return {
    request(payload: RequestPayload) {
      return provider.request(payload);
    },
  };
}
