import { isLunaRuntimeInterceptEnabled } from "@lunatest/runtime-intercept";

export function doctorCommand(nodeEnv = process.env.NODE_ENV): string {
  const enabled = isLunaRuntimeInterceptEnabled();
  const guard = nodeEnv === "development" ? "pass" : "blocked";

  return [
    "Doctor",
    `node_env=${nodeEnv ?? "undefined"}`,
    `runtime_intercept=${enabled ? "enabled" : "disabled"}`,
    `guard=${guard}`,
  ].join("\n");
}
