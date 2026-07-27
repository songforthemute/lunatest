# Wagmi 설정

`withLunaWagmiConfig`는 wagmi 형식의 설정에 이미 선언된 chain마다 Luna transport를 설치합니다. 이 함수는 새 설정을 반환할 뿐 wagmi client를 만들거나 구성하지는 않습니다.

```ts
import { LunaProvider } from "@lunatest/core";
import { withLunaWagmiConfig } from "@lunatest/react";

const provider = new LunaProvider({ chainId: "0x1" });
const config = withLunaWagmiConfig({ chains: [{ id: 1 }] }, provider);

await config.transports?.[1]?.request({ method: "eth_chainId" });
```

반환된 transport를 애플리케이션이 사용하는 wagmi 통합 지점에 넣으세요. adapter는 EIP-1193 형식의 `{ method, params }` 요청을 provider로 전달합니다.
