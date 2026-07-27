# Ethers Setup

`createEthersAdapter` exposes the small `send(method, params?)` surface needed
to pass LunaTest requests through an ethers-style boundary.

```ts
import { LunaProvider } from "@lunatest/core";
import { createEthersAdapter } from "@lunatest/react";

const provider = new LunaProvider({ chainId: "0x1" });
const ethersLike = createEthersAdapter(provider);

const chainId = await ethersLike.send("eth_chainId");
```

The adapter forwards the method and parameters to `LunaProvider.request`. It is
not an ethers provider instance, so create any version-specific ethers wrapper
in the application that consumes it.
