import { useEffect, useState } from "react";

import {
  createDefiDashboardSnapshot,
  shortAddress,
  type DefiDashboardSnapshot,
  type ProtocolDogfoodCard,
} from "./dogfood";

type DefiDashboardProps = {
  initialSnapshot?: DefiDashboardSnapshot;
};

function statusLabel(status: ProtocolDogfoodCard["receiptStatus"]): string {
  if (status === "0x1") {
    return "confirmed";
  }
  if (status === "0x0") {
    return "reverted";
  }
  return "pending";
}

function ProtocolCard({ protocol }: { protocol: ProtocolDogfoodCard }) {
  return (
    <article className="protocol-card">
      <div className="protocol-card__header">
        <span className="protocol-card__id">{protocol.id}</span>
        <span className="protocol-card__level">{protocol.supportLevel}</span>
      </div>
      <h2>{protocol.label}</h2>
      <div className="metric-row">
        <span>{protocol.primaryMetric}</span>
        <strong>{protocol.healthFactor ?? protocol.quoteOut}</strong>
      </div>
      <div className="metric-row metric-row--muted">
        <span>quote out</span>
        <strong>{protocol.quoteOut}</strong>
      </div>
      <p>{protocol.note}</p>
      <span className={`receipt receipt--${statusLabel(protocol.receiptStatus)}`}>
        receipt {statusLabel(protocol.receiptStatus)}
      </span>
    </article>
  );
}

export function DefiDashboard({ initialSnapshot }: DefiDashboardProps) {
  const [snapshot, setSnapshot] = useState<DefiDashboardSnapshot | undefined>(initialSnapshot);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialSnapshot) {
      return;
    }

    let cancelled = false;
    createDefiDashboardSnapshot()
      .then((nextSnapshot) => {
        if (!cancelled) {
          setSnapshot(nextSnapshot);
        }
      })
      .catch((nextError: unknown) => {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initialSnapshot]);

  return (
    <main className="dashboard-shell">
      <section className="hero-panel">
        <p className="eyebrow">LunaTest deterministic L3 dogfood</p>
        <h1>Protocol Risk Terminal</h1>
        <p className="hero-copy">
          A runnable DeFi dashboard that exercises built-in protocol presets through
          public LunaTest runtime APIs and the injected provider path.
        </p>
        <div className="wallet-strip">
          <span>Wallet</span>
          <strong>{snapshot ? shortAddress(snapshot.wallet.account) : "booting"}</strong>
          <span>Chain</span>
          <strong>{snapshot?.wallet.chainId ?? "..."}</strong>
          <span>Native</span>
          <strong>{snapshot?.wallet.nativeBalance ?? "..."}</strong>
        </div>
      </section>

      {error ? <section className="error-panel">Runtime dogfood failed: {error}</section> : null}

      <section className="protocol-grid" aria-label="Protocol dogfood evidence">
        {snapshot
          ? snapshot.protocols.map((protocol) => (
              <ProtocolCard key={protocol.id} protocol={protocol} />
            ))
          : Array.from({ length: 4 }, (_, index) => (
              <article className="protocol-card protocol-card--loading" key={index}>
                <span className="protocol-card__id">loading</span>
                <h2>Materializing preset</h2>
                <p>Running deterministic provider requests...</p>
              </article>
            ))}
      </section>
    </main>
  );
}
