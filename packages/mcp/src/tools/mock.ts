export function createMockTools(initialState: Record<string, unknown> = {}) {
  let state: Record<string, unknown> = { ...initialState };

  return {
    async getState() {
      return { ...state };
    },

    async setState(next: Record<string, unknown>) {
      state = { ...next };
      return { ...state };
    },
  };
}
