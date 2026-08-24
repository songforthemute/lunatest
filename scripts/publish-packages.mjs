import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { nextPackages, packageNames, stablePackages } from "./package-roster.mjs";

const ANSI_ESCAPE = /\u001B\[[0-?]*[ -/]*[@-~]/g;

export function collectPublishedPackages(output, selectedPackageNames) {
  const selected = new Set(selectedPackageNames);
  const published = new Map();

  for (const line of output.replace(ANSI_ESCAPE, "").split("\n")) {
    const match = line.match(/^\+\s+((?:@[^/\s]+\/)?[^@\s]+)@([^\s]+)\s*$/);
    if (!match || !selected.has(match[1])) {
      continue;
    }
    published.set(match[1], match[2]);
  }

  return [...published].map(([name, version]) => ({ name, version }));
}

export function createChangesetsTagOutput({ output, selectedPackageNames, dryRun }) {
  if (dryRun) {
    return "";
  }

  return collectPublishedPackages(output, selectedPackageNames)
    .map(({ name, version }) => `New tag: ${name}@${version}\n`)
    .join("");
}

function readArg(args, name, defaultValue) {
  const prefix = `--${name}=`;
  const match = args.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : defaultValue;
}

export function main(args = process.argv.slice(2)) {
  const channel = readArg(args, "channel", "stable");
  const selectedPackages = channel === "next" ? nextPackages : stablePackages;
  const defaultTag = channel === "next" ? "next" : "latest";
  const tag = readArg(args, "tag", defaultTag);
  const dryRun = args.includes("--dry-run");

  if (channel !== "stable" && channel !== "next") {
    throw new Error(`Unsupported publish channel: ${channel}`);
  }

  if (selectedPackages.length === 0) {
    process.stdout.write(`[publish-packages] No packages configured for ${channel}; skipping.\n`);
    return 0;
  }

  const publishArgs = [
    ...packageNames(selectedPackages).flatMap((name) => ["--filter", name]),
    "publish",
    "--access",
    "public",
    "--no-git-checks",
    "--tag",
    tag,
  ];

  if (dryRun) {
    publishArgs.push("--dry-run");
  }

  const result = spawnSync("pnpm", publishArgs, {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  const status = result.status ?? 1;
  if (status !== 0) {
    return status;
  }

  process.stdout.write(
    createChangesetsTagOutput({
      output: result.stdout ?? "",
      selectedPackageNames: packageNames(selectedPackages),
      dryRun,
    }),
  );
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exitCode = main();
}
