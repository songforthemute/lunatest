import { spawnSync as defaultSpawnSync } from "node:child_process";

import { formatCommandFailure, resolveCommandInvocation } from "./smoke-helpers.mjs";

export function runBuildCommand(command, args, options = {}) {
  const {
    comSpec,
    cwd = process.cwd(),
    env = process.env,
    platform,
    spawnSync = defaultSpawnSync,
    stdio = "pipe",
  } = options;
  const invocation = resolveCommandInvocation(command, args, { comSpec, platform });
  const result = spawnSync(invocation.command, invocation.args, {
    cwd,
    encoding: "utf8",
    env,
    shell: invocation.shell,
    stdio,
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";

  return {
    exitCode: result.status ?? 1,
    failureMessage: result.error
      ? formatCommandFailure({
        ...invocation,
        reason: result.error.message,
        stderr,
        stdout,
      })
      : null,
    invocation,
    stderr,
    stdout,
  };
}
