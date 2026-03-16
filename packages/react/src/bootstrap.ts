import {
  createLunaWalletAssetState,
  normalizeWalletPermissions,
  type LunaWalletAssetState,
  type LunaWalletPermission,
} from "@lunatest/contracts";
import type { LuaConfig } from "@lunatest/core";
import {
  loadLunaConfig,
  createPresetRegistry,
  materializeProtocolPreset,
  materializeWalletPreset,
  type PresetRegistry,
  type ProjectPresetSources,
} from "@lunatest/core";
import {
  applyInterceptState,
  enableLunaRuntimeIntercept,
  setWalletSession,
  setRouteMocks,
  type LunaRuntimeInterceptConfig,
} from "@lunatest/runtime-intercept";

import { mountLunaDevtools } from "./devtools/mount.js";
import { resolveNodeEnv } from "./node-env.js";

export type LunaBootstrapOptions = {
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
  unmountDevtools?: () => void;
  config: LuaConfig;
};

function toRuntimeConfig(
  config: LuaConfig,
  configOverride: Partial<LunaRuntimeInterceptConfig> | undefined,
): LunaRuntimeInterceptConfig {
  return {
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

export async function bootstrapLunaRuntime(
  options: LunaBootstrapOptions = {},
): Promise<LunaBootstrapResult> {
  const config = await loadLunaConfig(options.source ?? "./lunatest.lua");
  const nodeEnv = resolveNodeEnv(options.nodeEnv);
  const presetRegistry =
    options.presetRegistry ??
    createPresetRegistry({
      projectSources: options.projectPresetSources,
    });
  const runtimeConfig = toRuntimeConfig(config, options.configOverride);
  const enabled = enableLunaRuntimeIntercept(runtimeConfig, nodeEnv);

  if (!enabled) {
    return {
      enabled: false,
      config,
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
    unmountDevtools,
    config,
  };
}
