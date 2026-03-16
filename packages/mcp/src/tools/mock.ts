import {
  deepClone,
  deepMerge,
  type ProtocolPresetManifest,
  type ProtocolPresetMaterialization,
  type WalletPresetManifest,
  type WalletPresetMaterialization,
} from "@lunatest/contracts";
import {
  getProtocolPreset as coreGetProtocolPreset,
  getWalletPreset as coreGetWalletPreset,
  listProtocolPresets as coreListProtocolPresets,
  listWalletPresets as coreListWalletPresets,
  materializeProtocolPreset as coreMaterializeProtocolPreset,
  materializeWalletPreset as coreMaterializeWalletPreset,
} from "@lunatest/core";

export function createMockTools(initialState: Record<string, unknown> = {}) {
  let state: Record<string, unknown> = deepClone(initialState);
  let routes: Array<Record<string, unknown>> = [];

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
      return (await coreListProtocolPresets()).map((preset) => preset.id);
    },

    async listProtocolPresets(): Promise<ProtocolPresetManifest[]> {
      return coreListProtocolPresets();
    },

    async getProtocolPreset(id: string): Promise<ProtocolPresetManifest | null> {
      return coreGetProtocolPreset(id);
    },

    async applyProtocolPreset(
      id: string,
      params: Record<string, unknown> = {},
    ): Promise<ProtocolPresetMaterialization> {
      const materialized = await coreMaterializeProtocolPreset(id, params);
      state = deepMerge(state, {
        walletSession: materialized.walletSession,
        ...materialized.interceptState,
      });
      routes = deepClone(materialized.routeMocks as unknown as Array<Record<string, unknown>>);
      return materialized;
    },

    async listWalletPresets(): Promise<WalletPresetManifest[]> {
      return coreListWalletPresets();
    },

    async getWalletPreset(id: string): Promise<WalletPresetManifest | null> {
      return coreGetWalletPreset(id);
    },

    async applyWalletPreset(
      id: string,
      params: Record<string, unknown> = {},
    ): Promise<WalletPresetMaterialization> {
      const materialized = await coreMaterializeWalletPreset(id, params);
      state = deepMerge(state, {
        walletSession: materialized.walletSession,
      });
      return materialized;
    },
  };
}
