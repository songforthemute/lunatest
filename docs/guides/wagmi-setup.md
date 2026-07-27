# Wagmi Setup

Use `withLunaWagmiConfig` to install a Luna transport for the chains already
listed in a wagmi-like configuration. It returns a new config and does not
create or configure a wagmi client by itself.

```ts
import { LunaProvider } from "@lunatest/core";
import { withLunaWagmiConfig } from "@lunatest/react";

const provider = new LunaProvider({ chainId: "0x1" });
const config = withLunaWagmiConfig({ chains: [{ id: 1 }] }, provider);

await config.transports?.[1]?.request({ method: "eth_chainId" });
```

Supply the returned transport at the wagmi integration point in your app. The
adapter forwards EIP-1193-style `{ method, params }` requests to the provider.
