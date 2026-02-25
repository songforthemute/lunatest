export function createMockTools(initialState: Record<string, unknown> = {}) {
  let state: Record<string, unknown> = { ...initialState };
  const presets = ["uniswap_v2", "uniswap_v3", "curve"];

  return {
    async getState() {
      return { ...state };
    },

    async setState(next: Record<string, unknown>) {
      state = { ...next };
      return { ...state };
    },

    async listPresets() {
      return [...presets];
    },
  };
}
