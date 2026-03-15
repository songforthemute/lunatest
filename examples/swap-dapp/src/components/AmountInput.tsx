type AmountInputProps = {
  value: string;
  onChange: (next: string) => void;
  balanceLabel: string;
};

export function AmountInput(props: AmountInputProps) {
  return (
    <section className="card amount-card">
      <label htmlFor="swap-amount" className="field-label">
        Amount In
      </label>
      <input
        id="swap-amount"
        inputMode="decimal"
        value={props.value}
        onChange={(event) => props.onChange(event.currentTarget.value)}
        placeholder="0.0"
        className="amount-input"
      />
      <p className="balance-label">{props.balanceLabel}</p>
    </section>
  );
}
