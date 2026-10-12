# Wagmi 통합

`@lunatest/react/wagmi`는 `LunaProvider`를 실제 viem `Transport`에 연결하며,
wagmi는 이를 `createConfig`로 설치할 수 있습니다.

```ts
import { LunaProvider } from "@lunatest/core";
import { createLunaWagmiTransport } from "@lunatest/react/wagmi";
import { createLunaWagmiConnector } from "@lunatest/react/wagmi/connector";
import { createConfig } from "@wagmi/core";
import { mainnet } from "viem/chains";

const provider = new LunaProvider({ chainId: "0x1" });

const config = createConfig({
  batch: { multicall: false },
  chains: [mainnet],
  connectors: [createLunaWagmiConnector(provider)],
  transports: { [mainnet.id]: createLunaWagmiTransport(provider) },
});

await config.getClient({ chainId: mainnet.id }).request({
  method: "eth_chainId",
});
```

이 경로는 `@wagmi/core@3.6.4`, `viem@2.55.11` 조합으로 계약 테스트됩니다.
기존 `withLunaWagmiConfig` helper는 실제 wagmi transport가 아닌 구조적 transport
객체만 반환했으므로 deprecated되었습니다.

connector는 wagmi 연결 상태, chain 전환, transaction 제출, receipt 조회, provider
이벤트, disconnect 경계에서 계약됩니다. transport는 viem-only subpath로 유지되므로
wagmi를 사용하지 않는 소비자는 선택적 `@wagmi/core` peer를 불러오지 않습니다.
