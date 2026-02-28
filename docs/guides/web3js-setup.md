# Web3.js Setup

`createWeb3JsAdapter`를 사용하면 Web3.js 스타일 `request` 인터페이스로 바로 연결할 수 있습니다.

```ts
import { LunaProvider } from "@lunatest/core";
import { createWeb3JsAdapter } from "@lunatest/react";

const luna = new LunaProvider({ chainId: "0x1" });
const web3Provider = createWeb3JsAdapter(luna);

await web3Provider.request({ method: "eth_chainId" });
```
