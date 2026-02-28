# Ethers Setup

`createEthersAdapter`를 사용하면 EIP-1193 provider를 ethers 스타일 `send` 인터페이스로 연결할 수 있습니다.

```ts
import { LunaProvider } from "@lunatest/core";
import { createEthersAdapter } from "@lunatest/react";

const luna = new LunaProvider({ chainId: "0x1" });
const ethersProvider = createEthersAdapter(luna);

await ethersProvider.send("eth_chainId");
```
