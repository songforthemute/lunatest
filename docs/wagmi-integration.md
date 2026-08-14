# Wagmi Integration

`@lunatest/react/wagmi` adapts a `LunaProvider` to a real viem `Transport` that
wagmi can install through `createConfig`.

```ts
import { LunaProvider } from "@lunatest/core";
import { createLunaWagmiTransport } from "@lunatest/react/wagmi";
import { createLunaWagmiConnector } from "@lunatest/react/wagmi/connector";
import { createConfig } from "@wagmi/core";
import { mainnet } from "viem/chains";

const provider = new LunaProvider({ chainId: "0x1" });

const config = createConfig({
  batch: { multicall: false },
  chains: [mainnet],
  connectors: [createLunaWagmiConnector(provider)],
  transports: { [mainnet.id]: createLunaWagmiTransport(provider) },
});

await config.getClient({ chainId: mainnet.id }).request({
  method: "eth_chainId",
});
```

This path is contract-tested against `@wagmi/core@3.6.4` and `viem@2.55.11`.
The legacy `withLunaWagmiConfig` helper is deprecated because its structural
transport object was never a real wagmi transport.

The connector is contracted through wagmi connection state, chain switching,
transaction submission, receipt lookup, provider events, and disconnect. The
transport stays in its viem-only subpath so consumers that do not use wagmi do
not load the optional `@wagmi/core` peer.
