import {
  enableLunaRuntimeIntercept,
  type LunaRuntimeInterceptConfig,
} from "@lunatest/runtime-intercept";
import { resolveNodeEnv } from "./node-env.js";

export type EnableLunaInterceptOptions = {
  config?: LunaRuntimeInterceptConfig;
  nodeEnv?: string;
};

export function enableLunaIntercept(options: EnableLunaInterceptOptions = {}): boolean {
  const nodeEnv = resolveNodeEnv(options.nodeEnv);

  return enableLunaRuntimeIntercept(options.config ?? {}, nodeEnv);
}
