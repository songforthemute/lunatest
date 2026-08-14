# Wagmi Setup

Use `createLunaWagmiTransport` at wagmi's real `createConfig` transport
extension point. The bridge is contract-tested with `@wagmi/core@3.6.4` and
`viem@2.55.11`.

```ts
import { LunaProvider } from "@lunatest/core";
import { createLunaWagmiTransport } from "@lunatest/react/wagmi";
import { createLunaWagmiConnector } from "@lunatest/react/wagmi/connector";
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
  connectors: [createLunaWagmiConnector(provider)],
  multiInjectedProviderDiscovery: false,
  transports: { [mainnet.id]: createLunaWagmiTransport(provider) },
});

await getBalance(config, { address: account, chainId: mainnet.id });
```

The transport also works with viem public and wallet clients. Set wagmi
multicall batching to `false` when using the minimal `LunaProvider`; otherwise
wagmi may route native balance reads through Multicall3 `eth_call` instead of
`eth_getBalance`.

The connector is contract-tested through wagmi `connect`, connection state,
chain switching, transaction submission, receipt lookup, external provider
events, and disconnect. The transport remains a separate viem-only subpath, so
direct viem consumers do not need to install `@wagmi/core`.

`withLunaWagmiConfig` remains temporarily available for compatibility but is
deprecated. It returns only a structural wagmi-like object and is not the
supported real wagmi integration.
