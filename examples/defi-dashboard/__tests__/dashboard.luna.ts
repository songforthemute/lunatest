export const dashboardScenario = {
  name: "dashboard-load",
  given: {
    wallet: { connected: true },
  },
  when: { action: "load" },
  then_ui: { loading: false },
};
