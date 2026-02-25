# Ethers Setup

`withLunaEthersProvider`로 ethers provider를 교체합니다.

```ts
import { LunaProvider } from "@lunatest/core";
import { withLunaEthersProvider } from "@lunatest/react";

const luna = new LunaProvider({ chainId: "0x1" });
const ethersProvider = withLunaEthersProvider(luna);
```
