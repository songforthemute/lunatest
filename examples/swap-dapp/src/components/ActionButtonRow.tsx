type ActionButtonRowProps = {
  connecting: boolean;
  quoting: boolean;
  approving: boolean;
  swapping: boolean;
  canConnect: boolean;
  canQuote: boolean;
  canApprove: boolean;
  canSwap: boolean;
  onConnect: () => void;
  onQuote: () => void;
  onApprove: () => void;
  onSwap: () => void;
};

export function ActionButtonRow(props: ActionButtonRowProps) {
  return (
    <section className="card action-card">
      <h2>Actions</h2>
      <div className="action-grid">
        <button type="button" disabled={!props.canConnect || props.connecting} onClick={props.onConnect}>
          {props.connecting ? "Connecting..." : "Connect Wallet"}
        </button>
        <button type="button" disabled={!props.canQuote || props.quoting} onClick={props.onQuote}>
          {props.quoting ? "Quoting..." : "Quote"}
        </button>
        <button type="button" disabled={!props.canApprove || props.approving} onClick={props.onApprove}>
          {props.approving ? "Approving..." : "Approve"}
        </button>
        <button type="button" disabled={!props.canSwap || props.swapping} onClick={props.onSwap}>
          {props.swapping ? "Swapping..." : "Swap"}
        </button>
      </div>
    </section>
  );
}
