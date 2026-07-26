# React Integration

`LunaTestProvider` puts one `LunaProvider` into React context. Pass an existing
provider when the application owns its lifecycle, or pass `options` to create
one. Equivalent option values preserve the provider instance across rerenders.

```tsx
import { LunaTestProvider, useLunaTest } from "@lunatest/react";

function AccountButton() {
  const { provider } = useLunaTest();

  async function loadAccounts() {
    const accounts = await provider.request({ method: "eth_accounts" });
    console.log(accounts);
  }

  return <button onClick={loadAccounts}>Load accounts</button>;
}

export function Root() {
  return (
    <LunaTestProvider options={{ chainId: "0x1" }}>
      <AccountButton />
    </LunaTestProvider>
  );
}
```

`useLunaTest` must run below `LunaTestProvider`. For use outside context,
`useLunaProvider(options)` creates a stable provider for equivalent option
values. See the focused adapter guides for [wagmi](./wagmi-setup.md),
[ethers](./ethers-setup.md), and [Web3.js](./web3js-setup.md).
