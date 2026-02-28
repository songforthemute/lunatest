import { deepClone, deepMerge } from "@lunatest/contracts";

export function createMockTools(initialState: Record<string, unknown> = {}) {
  let state: Record<string, unknown> = deepClone(initialState);
  let routes: Array<Record<string, unknown>> = [];
  const presets = ["uniswap_v2", "uniswap_v3", "curve", "aave"];

  return {
    async getState() {
      return deepClone(state);
    },

    async setState(next: Record<string, unknown>) {
      state = deepClone(next);
      return deepClone(state);
    },

    async patchState(partial: Record<string, unknown>) {
      state = deepMerge(state, partial);
      return deepClone(state);
    },

    async setRoutes(nextRoutes: Array<Record<string, unknown>>) {
      routes = deepClone(nextRoutes);
      return deepClone(routes);
    },

    async getRoutes() {
      return deepClone(routes);
    },

    async listPresets() {
      return [...presets];
    },
  };
}
