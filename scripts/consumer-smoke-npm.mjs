import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

function createSmokeScript(channel) {
  const nextImports =
    channel === "next"
      ? `
import { toLunaPass, createLunaVitestPlugin } from "@lunatest/vitest-plugin";
import { createLunaFixture } from "@lunatest/playwright-plugin";
`
      : "";

  const nextChecks =
    channel === "next"
      ? `
if (typeof toLunaPass !== "function") throw new Error("toLunaPass export missing");
if (typeof createLunaVitestPlugin !== "function") throw new Error("createLunaVitestPlugin export missing");
if (typeof createLunaFixture !== "function") throw new Error("createLunaFixture export missing");
`
      : "";

  return `
import { loadLunaConfig as loadLunaConfigNode, executeLuaScenario } from "@lunatest/core";
import { loadLunaConfig as loadLunaConfigBrowser } from "@lunatest/core/browser";
import { bootstrapLunaRuntime } from "@lunatest/react";
import { setRouteMocks } from "@lunatest/runtime-intercept";
import { createMcpServer } from "@lunatest/mcp";
${nextImports}

if (typeof loadLunaConfigNode !== "function") throw new Error("loadLunaConfig export missing");
if (typeof loadLunaConfigBrowser !== "function") throw new Error("browser loadLunaConfig export missing");
if (typeof executeLuaScenario !== "function") throw new Error("executeLuaScenario export missing");
if (typeof bootstrapLunaRuntime !== "function") throw new Error("bootstrapLunaRuntime export missing");
if (typeof setRouteMocks !== "function") throw new Error("setRouteMocks export missing");
if (typeof createMcpServer !== "function") throw new Error("createMcpServer export missing");
${nextChecks}
`;
}

const channel = readArg("channel", "stable");
const stableTag = readArg("stable-tag", readArg("tag", "latest"));
const nextTag = readArg("next-tag", "next");
const tempRoot = mkdtempSync(join(tmpdir(), `lunatest-consumer-npm-${channel}-`));

try {
  writeFileSync(
    join(tempRoot, "package.json"),
    JSON.stringify(
      {
        name: `lunatest-consumer-smoke-npm-${channel}`,
        private: true,
        type: "module",
      },
      null,
      2,
    ),
  );

  run("pnpm", ["add", ...buildInstallTargets(channel, stableTag, nextTag)], tempRoot, {
    stdio: "inherit",
  });

  writeFileSync(join(tempRoot, "smoke.mjs"), createSmokeScript(channel));

  run("node", ["./smoke.mjs"], tempRoot, { stdio: "inherit" });
  run("pnpm", ["exec", "lunatest", "doctor"], tempRoot, { stdio: "inherit" });
  startMcpSmoke(tempRoot);
  process.stdout.write(`[consumer-smoke:npm] OK (channel=${channel}, stable=${stableTag}, next=${nextTag})\n`);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
