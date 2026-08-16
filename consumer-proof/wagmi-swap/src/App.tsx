import { sepolia } from "viem/chains";

import { wagmiConfig } from "./wagmi";

export function App() {
  const configuredChain = wagmiConfig.chains[0];

  return (
    <main>
      <p className="eyebrow">External consumer baseline</p>
      <h1>Deterministic swap proof</h1>
      <p>
        The isolated application compiles against real React, wagmi Core, and
        viem packages before LunaTest behavior is added.
      </p>
      <dl>
        <div>
          <dt>Chain</dt>
          <dd>{configuredChain.name}</dd>
        </div>
        <div>
          <dt>Chain ID</dt>
          <dd>{configuredChain.id}</dd>
        </div>
        <div>
          <dt>Expected network</dt>
          <dd>{sepolia.name}</dd>
        </div>
      </dl>
      <p className="boundary">
        Wallet connection and connect → quote → approve → swap belong to the
        next proof task.
      </p>
    </main>
  );
}
