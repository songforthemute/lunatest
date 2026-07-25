import { runBuildCommand } from "../../../scripts/build-command.mjs";

const result = runBuildCommand("pnpm", ["exec", "vite", "build"], {
  cwd: process.cwd(),
});

const stdout = result.stdout ?? "";
const stderr = result.stderr ?? "";
const combined = `${stdout}\n${stderr}`;

process.stdout.write(stdout);
process.stderr.write(stderr);

if (result.failureMessage) {
  console.error(result.failureMessage);
}

if (result.exitCode !== 0) {
  process.exitCode = result.exitCode;
} else if (/Module "node:[^"]+" has been externalized for browser compatibility/u.test(combined)) {
  console.error(
    "[swap-dapp build] Browser build emitted node externalization warnings. This is a production-readiness regression.",
  );
  process.exitCode = 1;
}
