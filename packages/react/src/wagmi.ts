import { type LunaProvider } from "@lunatest/core";
import { custom, type CustomTransport } from "viem";

/**
 * Creates a real viem transport that wagmi can install in `createConfig`.
 *
 * The returned transport forwards JSON-RPC requests to the deterministic
 * LunaTest provider without opening an HTTP or WebSocket connection.
 */
export function createLunaWagmiTransport(provider: LunaProvider): CustomTransport {
  return custom(provider, {
    key: "lunatest",
    name: "LunaTest Provider",
    retryCount: 0,
  });
}
