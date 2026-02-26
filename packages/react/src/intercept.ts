import {
  enableLunaRuntimeIntercept,
  type LunaRuntimeInterceptConfig,
} from "@lunatest/runtime-intercept";

export type EnableLunaInterceptOptions = {
  config?: LunaRuntimeInterceptConfig;
  nodeEnv?: string;
};

export function enableLunaIntercept(options: EnableLunaInterceptOptions = {}): boolean {
  const nodeEnv =
    options.nodeEnv ??
    (typeof process !== "undefined" ? process.env.NODE_ENV : undefined);

  return enableLunaRuntimeIntercept(options.config ?? {}, nodeEnv);
}
