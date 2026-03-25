import type { TokenRuntime } from "../types";

type TokenPairCardProps = {
  tokenIn: TokenRuntime;
  tokenOut: TokenRuntime;
  onFlip: () => void;
};

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function TokenPairCard(props: TokenPairCardProps) {
  return (
    <section className="card token-pair-card">
      <div className="token-headline">
        <h2>Swap Pair</h2>
        <button type="button" onClick={props.onFlip} className="ghost-button">
          Flip
        </button>
      </div>
      <div className="token-row">
        <div>
          <p className="token-symbol">{props.tokenIn.symbol}</p>
          <p className="token-address">{shortAddress(props.tokenIn.address)}</p>
        </div>
        <span className="token-arrow">→</span>
        <div>
          <p className="token-symbol">{props.tokenOut.symbol}</p>
          <p className="token-address">{shortAddress(props.tokenOut.address)}</p>
        </div>
      </div>
    </section>
  );
}
