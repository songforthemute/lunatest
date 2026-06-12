import { spawnSync } from "node:child_process";

const result = spawnSync("pnpm", ["exec", "vite", "build"], {
  cwd: process.cwd(),
  encoding: "utf8",
  stdio: "pipe",
});

const stdout = result.stdout ?? "";
const stderr = result.stderr ?? "";
const combined = `${stdout}\n${stderr}`;

process.stdout.write(stdout);
process.stderr.write(stderr);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

if (/Module "node:[^"]+" has been externalized for browser compatibility/u.test(combined)) {
  console.error(
    "[defi-dashboard build] Browser build emitted node externalization warnings.",
  );
  process.exit(1);
}
