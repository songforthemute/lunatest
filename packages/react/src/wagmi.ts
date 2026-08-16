import { custom, type CustomTransport } from "viem";

type ProviderListener = (...args: unknown[]) => void;

/**
 * Public provider boundary shared by LunaTest's wagmi transport and connector.
 *
 * Both the standalone `LunaProvider` and the browser provider installed by
 * `bootstrapLunaRuntime` satisfy this structural contract.
 */
export type LunaWagmiProvider = {
  request: (payload: {
    method: string;
    params?: unknown[];
  }) => Promise<unknown>;
  on: (event: string, listener: ProviderListener) => unknown;
  removeListener: (event: string, listener: ProviderListener) => unknown;
};

/**
 * Creates a real viem transport that wagmi can install in `createConfig`.
 *
 * The returned transport forwards JSON-RPC requests to the deterministic
 * LunaTest provider without opening an HTTP or WebSocket connection.
 */
export function createLunaWagmiTransport(
  provider: LunaWagmiProvider,
): CustomTransport {
  return custom(provider, {
    key: "lunatest",
    name: "LunaTest Provider",
    retryCount: 0,
  });
}
