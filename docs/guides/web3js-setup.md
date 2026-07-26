# Web3.js Setup

`createWeb3JsAdapter` exposes an EIP-1193-style `request` method backed by a
`LunaProvider`.

```ts
import { LunaProvider } from "@lunatest/core";
import { createWeb3JsAdapter } from "@lunatest/react";

const provider = new LunaProvider({ chainId: "0x1" });
const web3Like = createWeb3JsAdapter(provider);

const chainId = await web3Like.request({ method: "eth_chainId" });
```

Use this adapter where the Web3.js version in your application accepts an
EIP-1193 provider. LunaTest does not instantiate or configure Web3.js itself.
