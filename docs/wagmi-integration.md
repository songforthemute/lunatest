# Wagmi Integration

`@lunatest/react` provides a wagmi-like adapter API.

## Example

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
```

`config.transports[1].request(...)` forwards to LunaProvider `request`.
