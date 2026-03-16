import {
  createLunaWalletAssetState,
  normalizeWalletPermissions,
  type LunaWalletAssetState,
  type LunaWalletPermission,
} from "@lunatest/contracts";
import type { LuaConfig } from "@lunatest/core/browser";
import {
  loadLunaConfig,
  createPresetRegistry,
  materializeProtocolPreset,
  materializeWalletPreset,
  type PresetRegistry,
  type ProjectPresetSources,
} from "@lunatest/core/browser";
import {
  applyInterceptState,
  enableLunaRuntimeIntercept,
  resolveEnabled,
  setWalletSession,
  setRouteMocks,
  type LunaRuntimeInterceptConfig,
} from "@lunatest/runtime-intercept";

import { mountLunaDevtools } from "./devtools/mount.js";
import { resolveNodeEnv } from "./node-env.js";

export type LunaBootstrapOptions = {
  enable?: boolean;
  source?: string | URL;
  nodeEnv?: string;
  mountDevtools?: boolean;
  devtoolsTargetId?: string;
  presetRegistry?: PresetRegistry;
  projectPresetSources?: ProjectPresetSources;
  protocolPresetId?: string;
  protocolPresetParams?: Record<string, unknown>;
  walletPresetId?: string;
  walletPresetParams?: Record<string, unknown>;
  walletFallbackMode?: "off" | "manual-toggle";
  walletPreset?: {
    address: string;
    chainId?: string;
    permissions?: Array<LunaWalletPermission | string>;
    assets?: Partial<LunaWalletAssetState>;
  };
  configOverride?: Partial<LunaRuntimeInterceptConfig>;
};

export type LunaBootstrapResult = {
  enabled: boolean;
  configLoaded: boolean;
  unmountDevtools?: () => void;
  config?: LuaConfig;
};

function toRuntimeConfig(
  config: LuaConfig,
  enable: boolean | undefined,
  configOverride: Partial<LunaRuntimeInterceptConfig> | undefined,
): LunaRuntimeInterceptConfig {
  return {
    enable,
    ...configOverride,
    intercept: {
      ...configOverride?.intercept,
      mode: configOverride?.intercept?.mode ?? config.mode,
      mockResponses: {
        ...(config.intercept?.mockResponses ?? {}),
        ...(configOverride?.intercept?.mockResponses ?? {}),
      },
    },
  };
}

function resolveBootstrapEnabled(
  options: LunaBootstrapOptions,
  nodeEnv: string | undefined,
): boolean {
  if (typeof options.enable === "boolean") {
    return options.enable;
  }

  return resolveEnabled(
    {
      enable: options.configOverride?.enable,
    },
    nodeEnv,
  );
}

export async function bootstrapLunaRuntime(
  options: LunaBootstrapOptions = {},
): Promise<LunaBootstrapResult> {
  const nodeEnv = resolveNodeEnv(options.nodeEnv);
  const bootstrapEnabled = resolveBootstrapEnabled(options, nodeEnv);

  if (!bootstrapEnabled) {
    return {
      enabled: false,
      configLoaded: false,
    };
  }

  const config = await loadLunaConfig(options.source ?? "./lunatest.lua");
  const presetRegistry =
    options.presetRegistry ??
    createPresetRegistry({
      projectSources: options.projectPresetSources,
    });
  const runtimeConfig = toRuntimeConfig(
    config,
    options.enable ?? options.configOverride?.enable,
    options.configOverride,
  );
  const enabled = enableLunaRuntimeIntercept(runtimeConfig, nodeEnv);

  if (!enabled) {
    return {
      enabled: false,
      config,
      configLoaded: true,
    };
  }

  const routeMocks = options.configOverride?.intercept?.routes ?? config.intercept?.routes ?? [];
  setRouteMocks(routeMocks);

  if (config.given) {
    applyInterceptState(config.given);
  }

  if (config.intercept?.state) {
    applyInterceptState(config.intercept.state);
  }

  if (options.protocolPresetId) {
    const materialized = await materializeProtocolPreset(
      options.protocolPresetId,
      options.protocolPresetParams,
      presetRegistry,
    );
    setRouteMocks(materialized.routeMocks);
    applyInterceptState(materialized.interceptState);
    setWalletSession(materialized.walletSession);
  }

  if (options.walletPresetId) {
    const materialized = await materializeWalletPreset(
      options.walletPresetId,
      options.walletPresetParams,
      presetRegistry,
    );
    setWalletSession(materialized.walletSession);
  }

  if (options.walletPreset) {
    setWalletSession({
      enabled: false,
      connected: false,
      chainId: options.walletPreset.chainId ?? "0x1",
      accounts: [options.walletPreset.address],
      permissions: normalizeWalletPermissions(options.walletPreset.permissions),
      assets: createLunaWalletAssetState(options.walletPreset.assets),
    });
  }

  const unmountDevtools =
    options.mountDevtools === false
      ? undefined
      : mountLunaDevtools({
          targetId: options.devtoolsTargetId,
          nodeEnv,
          panelProps: {
            presetRegistry,
            walletFallbackMode: options.walletFallbackMode ?? "off",
          },
        }) ?? undefined;

  return {
    enabled: true,
    configLoaded: true,
    unmountDevtools,
    config,
  };
}
