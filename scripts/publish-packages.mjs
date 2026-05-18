import { spawnSync } from "node:child_process";

import { nextPackages, packageNames, stablePackages } from "./package-roster.mjs";

function readArg(name, defaultValue) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : defaultValue;
}

const channel = readArg("channel", "stable");
const selectedPackages = channel === "next" ? nextPackages : stablePackages;
const defaultTag = channel === "next" ? "next" : "latest";
const tag = readArg("tag", defaultTag);
const dryRun = process.argv.includes("--dry-run");

if (channel !== "stable" && channel !== "next") {
  throw new Error(`Unsupported publish channel: ${channel}`);
}

const args = [
  ...packageNames(selectedPackages).flatMap((name) => ["--filter", name]),
  "publish",
  "--access",
  "public",
  "--no-git-checks",
  "--tag",
  tag,
];

if (dryRun) {
  args.push("--dry-run");
}

const result = spawnSync("pnpm", args, {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
