import type { SwapViewState } from "../types";

type TxStepperProps = {
  state: SwapViewState;
};

const STEP_ORDER: SwapViewState[] = [
  "idle",
  "wallet_connected",
  "quote_ready",
  "approval_required",
  "approval_pending",
  "ready_to_swap",
  "swap_pending",
  "swap_confirmed",
  "swap_failed",
];

export function TxStepper(props: TxStepperProps) {
  const currentIndex = STEP_ORDER.indexOf(props.state);

  return (
    <section className="card stepper-card">
      <h2>State Machine</h2>
      <ol className="stepper-list">
        {STEP_ORDER.map((step, index) => {
          const isActive = step === props.state;
          const isCompleted = index <= currentIndex && props.state !== "swap_failed";
          return (
            <li
              key={step}
              className={`stepper-item ${isActive ? "active" : ""} ${isCompleted ? "done" : ""}`}
            >
              <span>{step}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
