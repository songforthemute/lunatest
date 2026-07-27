# Web3.js 설정

`createWeb3JsAdapter`는 `LunaProvider`를 기반으로 EIP-1193 형식의 `request` 메서드를 제공합니다.

```ts
import { LunaProvider } from "@lunatest/core";
import { createWeb3JsAdapter } from "@lunatest/react";

const provider = new LunaProvider({ chainId: "0x1" });
const web3Like = createWeb3JsAdapter(provider);

const chainId = await web3Like.request({ method: "eth_chainId" });
```

사용하는 Web3.js 버전이 EIP-1193 provider를 받는 지점에 이 adapter를 사용하세요. LunaTest가 Web3.js 인스턴스를 직접 만들거나 구성하지는 않습니다.
