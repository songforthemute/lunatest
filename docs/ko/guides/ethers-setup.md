# Ethers 설정

`createEthersAdapter`는 LunaTest 요청을 ethers 스타일 경계로 전달하는 데 필요한 작은 `send(method, params?)` surface를 제공합니다.

```ts
import { LunaProvider } from "@lunatest/core";
import { createEthersAdapter } from "@lunatest/react";

const provider = new LunaProvider({ chainId: "0x1" });
const ethersLike = createEthersAdapter(provider);

const chainId = await ethersLike.send("eth_chainId");
```

adapter는 method와 parameter를 `LunaProvider.request`로 전달합니다. 이 객체는 ethers provider 인스턴스가 아니므로, 사용하는 ethers 버전에 필요한 wrapper는 애플리케이션에서 만드세요.
