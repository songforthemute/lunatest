export const swapScenario = {
  name: "swap-happy-path",
  given: {
    wallet: { connected: true, ETH: "10" },
  },
  when: { action: "swap" },
  then_ui: { success: true },
};
