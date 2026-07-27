# Wagmi Integration

`@lunatest/react` adapts a `LunaProvider` to the small wagmi-style transport
surface it exposes. The helper preserves the supplied config and replaces the
transport for every configured chain with a transport that calls
`LunaProvider.request`.

```ts
import { LunaProvider } from "@lunatest/core";
import { withLunaWagmiConfig } from "@lunatest/react";

const provider = new LunaProvider({ chainId: "0x1" });

const config = withLunaWagmiConfig(
  {
    chains: [{ id: 1 }],
  },
  provider,
);

await config.transports?.[1]?.request({ method: "eth_chainId" });
```

This returns a wagmi-like config rather than constructing a wagmi client. Pass
the resulting transport through the integration point used by the wagmi version
in your application.
