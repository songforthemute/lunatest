# Wagmi Integration

`@lunatest/react/wagmi` adapts a `LunaProvider` to a real viem `Transport` that
wagmi can install through `createConfig`.

```ts
import { LunaProvider } from "@lunatest/core";
import { createLunaWagmiTransport } from "@lunatest/react/wagmi";
import { createConfig } from "@wagmi/core";
import { mainnet } from "viem/chains";

const provider = new LunaProvider({ chainId: "0x1" });

const config = createConfig({
  batch: { multicall: false },
  chains: [mainnet],
  transports: { [mainnet.id]: createLunaWagmiTransport(provider) },
});

await config.getClient({ chainId: mainnet.id }).request({
  method: "eth_chainId",
});
```

This path is contract-tested against `@wagmi/core@3.6.4` and `viem@2.55.11`.
The legacy `withLunaWagmiConfig` helper is deprecated because its structural
transport object was never a real wagmi transport.

The current bridge covers wagmi public-client requests and direct viem wallet
clients. A LunaTest-specific wagmi connector and `connect()` / `useConnect`
state integration are not part of this contract yet.
