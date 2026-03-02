import type { LuaConfig } from "@lunatest/core";
import { loadLunaConfig } from "@lunatest/core";
import {
  applyInterceptState,
  enableLunaRuntimeIntercept,
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

  const unmountDevtools =
    options.mountDevtools === false
      ? undefined
      : mountLunaDevtools({
          targetId: options.devtoolsTargetId,
          nodeEnv,
        }) ?? undefined;

  return {
    enabled: true,
    unmountDevtools,
    config,
  };
}
