# Wagmi 설정

`createLunaWagmiTransport`를 실제 wagmi `createConfig`의 transport 확장점에 사용합니다. 이 bridge는 `@wagmi/core@3.6.4`, `viem@2.55.11` 조합으로 계약 테스트됩니다.

```ts
import { LunaProvider } from "@lunatest/core";
import { createLunaWagmiTransport } from "@lunatest/react/wagmi";
import { createConfig, getBalance } from "@wagmi/core";
import { mainnet } from "viem/chains";

const account = "0x1111111111111111111111111111111111111111";
const provider = new LunaProvider({
  chainId: "0x1",
  accounts: [account],
  balances: { [account]: "0xde0b6b3a7640000" },
});
const config = createConfig({
  batch: { multicall: false },
  chains: [mainnet],
  multiInjectedProviderDiscovery: false,
  transports: { [mainnet.id]: createLunaWagmiTransport(provider) },
});

await getBalance(config, { address: account, chainId: mainnet.id });
```

이 transport는 viem public/wallet client에서도 사용할 수 있습니다. 최소 `LunaProvider`를 사용할 때는 wagmi multicall batching을 `false`로 두세요. 그렇지 않으면 native balance 조회가 `eth_getBalance` 대신 Multicall3 `eth_call`로 전달될 수 있습니다.

현재 계약 범위는 wagmi public-client 요청과 viem wallet-client 요청입니다. wagmi connector 또는 `connect()` / `useConnect` 상태 연동까지 제공한다고 주장하지 않으며, 그 경계는 reference consumer에서 별도로 검증합니다.

`withLunaWagmiConfig`는 호환성을 위해 일시적으로 남아 있지만 deprecated입니다. 이 함수는 구조적인 wagmi-like 객체만 반환하며 실제 wagmi 연동의 지원 경로가 아닙니다.
