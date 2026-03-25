import {
  deepClone,
  deepMerge,
  type PresetDiagnostic,
  type ProtocolPresetCatalogEntry,
  type ProtocolPresetMaterialization,
  type WalletPresetCatalogEntry,
  type WalletPresetMaterialization,
} from "@lunatest/contracts";
import {
  createPresetRegistry,
  getPresetDiagnostics as coreGetPresetDiagnostics,
  getProtocolPreset as coreGetProtocolPreset,
  getWalletPreset as coreGetWalletPreset,
  listProtocolPresets as coreListProtocolPresets,
  listWalletPresets as coreListWalletPresets,
  type PresetRegistry,
  type ProjectPresetSources,
  materializeProtocolPreset as coreMaterializeProtocolPreset,
  materializeWalletPreset as coreMaterializeWalletPreset,
} from "@lunatest/core";

type CreateMockToolsOptions = {
  registry?: PresetRegistry;
  projectPresetSources?: ProjectPresetSources;
  getRegistry?: () => Promise<PresetRegistry>;
};

export function createMockTools(
  initialState: Record<string, unknown> = {},
  options: CreateMockToolsOptions = {},
) {
  let state: Record<string, unknown> = deepClone(initialState);
  let routes: Array<Record<string, unknown>> = [];
  let cachedRegistry: PresetRegistry | null = options.registry ?? null;

  const resolveRegistry = async (): Promise<PresetRegistry> => {
    if (cachedRegistry) {
      return cachedRegistry;
    }

    if (options.getRegistry) {
      cachedRegistry = await options.getRegistry();
      return cachedRegistry;
    }

    cachedRegistry = createPresetRegistry({
      projectSources: options.projectPresetSources,
    });
    return cachedRegistry;
  };

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
      return (await coreListProtocolPresets(await resolveRegistry())).map((preset) => preset.qualifiedId);
    },

    async listPresetDiagnostics(): Promise<PresetDiagnostic[]> {
      return coreGetPresetDiagnostics(await resolveRegistry());
    },

    async getPresetDiagnostic(code: string): Promise<PresetDiagnostic | null> {
      const diagnostics = await coreGetPresetDiagnostics(await resolveRegistry());
      return diagnostics.find((item) => item.code === code) ?? null;
    },

    async listProtocolPresets(): Promise<ProtocolPresetCatalogEntry[]> {
      return coreListProtocolPresets(await resolveRegistry());
    },

    async getProtocolPreset(id: string): Promise<ProtocolPresetCatalogEntry | null> {
      return coreGetProtocolPreset(id, await resolveRegistry());
    },

    async applyProtocolPreset(
      id: string,
      params: Record<string, unknown> = {},
    ): Promise<ProtocolPresetMaterialization> {
      const materialized = await coreMaterializeProtocolPreset(id, params, await resolveRegistry());
      state = deepMerge(state, {
        walletSession: materialized.walletSession,
        ...materialized.interceptState,
      });
      routes = deepClone(materialized.routeMocks as unknown as Array<Record<string, unknown>>);
      return materialized;
    },

    async listWalletPresets(): Promise<WalletPresetCatalogEntry[]> {
      return coreListWalletPresets(await resolveRegistry());
    },

    async getWalletPreset(id: string): Promise<WalletPresetCatalogEntry | null> {
      return coreGetWalletPreset(id, await resolveRegistry());
    },

    async applyWalletPreset(
      id: string,
      params: Record<string, unknown> = {},
    ): Promise<WalletPresetMaterialization> {
      const materialized = await coreMaterializeWalletPreset(id, params, await resolveRegistry());
      state = deepMerge(state, {
        walletSession: materialized.walletSession,
      });
      return materialized;
    },
  };
}
