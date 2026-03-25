import type { SwapWarnings } from "../lib/warnings";

type WarningPanelProps = {
  warnings: SwapWarnings;
};

export function WarningPanel(props: WarningPanelProps) {
  const messages = [
    props.warnings.wrongNetwork ? "Wrong network: switch wallet to Sepolia" : null,
    props.warnings.highSlippage ? "High slippage detected" : null,
    props.warnings.gasSpike ? "Gas spike warning (>= 300 gwei)" : null,
    props.warnings.insufficientBalance ? "Insufficient token balance" : null,
    props.warnings.insufficientAllowance ? "Allowance is below input amount" : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <section className="card warning-card">
      <h2>Warnings</h2>
      {messages.length === 0 ? <p>No active warnings.</p> : null}
      {messages.length > 0 ? (
        <ul>
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
