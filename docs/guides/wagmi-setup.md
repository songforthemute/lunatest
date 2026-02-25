# Wagmi Setup

`@lunatest/react`의 wagmi 어댑터를 사용해 provider 주입 지점을 교체합니다.

```ts
import { LunaProvider } from "@lunatest/core";
import { withLunaWagmiConfig } from "@lunatest/react";

const provider = new LunaProvider({ chainId: "0x1" });
const config = withLunaWagmiConfig({ chains: [{ id: 1 }] }, provider);
```
