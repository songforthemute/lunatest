import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createConsumerSmokeScript,
  reactPeerMatrix,
} from "./consumer-smoke-fixtures.mjs";
import { nextPackages, packageNames, stablePackages } from "./package-roster.mjs";
import { run, startMcpSmoke } from "./smoke-helpers.mjs";

function readArg(name, defaultValue) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : defaultValue;
}

function buildInstallTargets(channel, stableTag, nextTag) {
  const stable = packageNames(stablePackages).map((name) => `${name}@${stableTag}`);

  if (channel !== "next") {
    return stable;
  }

  return [
    ...stable,
    ...packageNames(nextPackages).map((name) => `${name}@${nextTag}`),
  ];
}

const channel = readArg("channel", "stable");
const stableTag = readArg("stable-tag", readArg("tag", "latest"));
const nextTag = readArg("next-tag", "next");
const tempRoot = mkdtempSync(join(tmpdir(), `lunatest-consumer-npm-${channel}-`));

try {
  for (const reactPeer of reactPeerMatrix) {
    const consumerDir = join(tempRoot, reactPeer.label);

    mkdirSync(consumerDir, { recursive: true });

    writeFileSync(
      join(consumerDir, "package.json"),
      JSON.stringify(
        {
          name: `lunatest-consumer-smoke-npm-${channel}-${reactPeer.label}`,
          private: true,
          type: "module",
        },
        null,
        2,
      ),
    );

    run(
      "pnpm",
      [
        "add",
        ...reactPeer.dependencies,
        ...buildInstallTargets(channel, stableTag, nextTag),
      ],
      consumerDir,
      {
        stdio: "inherit",
      },
    );

    writeFileSync(
      join(consumerDir, "smoke.mjs"),
      createConsumerSmokeScript({ includeNextPackages: channel === "next" }),
    );

    run("node", ["./smoke.mjs"], consumerDir, { stdio: "inherit" });
    run("pnpm", ["exec", "lunatest", "doctor"], consumerDir, { stdio: "inherit" });
    startMcpSmoke(consumerDir);
    process.stdout.write(
      `[consumer-smoke:npm] OK (channel=${channel}, react=${reactPeer.label}, stable=${stableTag}, next=${nextTag})\n`,
    );
  }
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
