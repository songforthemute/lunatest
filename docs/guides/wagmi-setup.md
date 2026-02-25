# Wagmi Setup

`@lunatest/react`의 wagmi 어댑터를 사용하면 provider 주입 지점을 간단히 교체할 수 있습니다.

```ts
import { LunaProvider } from "@lunatest/core";
import { withLunaWagmiConfig } from "@lunatest/react";

const provider = new LunaProvider({ chainId: "0x1" });
const config = withLunaWagmiConfig({ chains: [{ id: 1 }] }, provider);
```
