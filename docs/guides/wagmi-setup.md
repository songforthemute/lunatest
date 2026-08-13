# Wagmi Setup

Use `createLunaWagmiTransport` at wagmi's real `createConfig` transport
extension point. The bridge is contract-tested with `@wagmi/core@3.6.4` and
`viem@2.55.11`.

```ts
import { LunaProvider } from "@lunatest/core";
import { createLunaWagmiTransport } from "@lunatest/react/wagmi";
import { createConfig, getBalance } from "@wagmi/core";
import { mainnet } from "viem/chains";

const account = "0x1111111111111111111111111111111111111111";
const provider = new LunaProvider({
  chainId: "0x1",
  accounts: [account],
  balances: { [account]: "0xde0b6b3a7640000" },
});
const config = createConfig({
  batch: { multicall: false },
  chains: [mainnet],
  multiInjectedProviderDiscovery: false,
  transports: { [mainnet.id]: createLunaWagmiTransport(provider) },
});

await getBalance(config, { address: account, chainId: mainnet.id });
```

The transport also works with viem public and wallet clients. Set wagmi
multicall batching to `false` when using the minimal `LunaProvider`; otherwise
wagmi may route native balance reads through Multicall3 `eth_call` instead of
`eth_getBalance`.

This contract covers wagmi public-client requests and viem wallet-client
requests. It does not yet provide a wagmi connector or claim `connect()` /
`useConnect` state integration; that boundary is validated separately by the
reference consumer.

`withLunaWagmiConfig` remains temporarily available for compatibility but is
deprecated. It returns only a structural wagmi-like object and is not the
supported real wagmi integration.
