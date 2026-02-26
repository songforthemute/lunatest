export function createMockTools(initialState: Record<string, unknown> = {}) {
  let state: Record<string, unknown> = { ...initialState };
  let routes: Array<Record<string, unknown>> = [];
  const presets = ["uniswap_v2", "uniswap_v3", "curve", "aave"];

  const mergeRecord = (
    base: Record<string, unknown>,
    patch: Record<string, unknown>,
  ): Record<string, unknown> => {
    const next: Record<string, unknown> = { ...base };

    for (const [key, value] of Object.entries(patch)) {
      const baseValue = next[key];
      if (
        baseValue &&
        typeof baseValue === "object" &&
        !Array.isArray(baseValue) &&
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        next[key] = mergeRecord(
          baseValue as Record<string, unknown>,
          value as Record<string, unknown>,
        );
        continue;
      }

      next[key] = value;
    }

    return next;
  };

  return {
    async getState() {
      return { ...state };
    },

    async setState(next: Record<string, unknown>) {
      state = { ...next };
      return { ...state };
    },

    async patchState(partial: Record<string, unknown>) {
      state = mergeRecord(state, partial);
      return { ...state };
    },

    async setRoutes(nextRoutes: Array<Record<string, unknown>>) {
      routes = nextRoutes.map((route) => ({ ...route }));
      return routes.map((route) => ({ ...route }));
    },

    async getRoutes() {
      return routes.map((route) => ({ ...route }));
    },

    async listPresets() {
      return [...presets];
    },
  };
}
