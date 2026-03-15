import type { QuoteResult } from "../types";

type QuotePanelProps = {
  quote: QuoteResult | null;
  quoteError: string | null;
  quoteLoading: boolean;
  gasPriceGwei: number;
};

export function QuotePanel(props: QuotePanelProps) {
  return (
    <section className="card quote-card">
      <h2>Quote</h2>
      {props.quoteLoading ? <p>Fetching quote from Sepolia QuoterV2...</p> : null}
      {props.quoteError ? <p className="error-text">{props.quoteError}</p> : null}
      {props.quote ? (
        <dl>
          <div className="kv-row">
            <dt>Amount Out</dt>
            <dd>{props.quote.amountOutFormatted}</dd>
          </div>
          <div className="kv-row">
            <dt>Price Impact</dt>
            <dd>{props.quote.priceImpactPct.toFixed(2)}%</dd>
          </div>
          <div className="kv-row">
            <dt>Gas Estimate</dt>
            <dd>{props.quote.gasEstimateFormatted}</dd>
          </div>
          <div className="kv-row">
            <dt>Gas Price</dt>
            <dd>{props.gasPriceGwei.toFixed(2)} gwei</dd>
          </div>
        </dl>
      ) : (
        <p>Enter amount and press Quote.</p>
      )}
    </section>
  );
}
