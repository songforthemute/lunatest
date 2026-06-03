import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { packageNames, stablePackages } from "./package-roster.mjs";
import {
  createTarballOverrides,
  formatWorkspaceOverrides,
} from "./pnpm-workspace-overrides.mjs";
import { packPackage, run, startMcpSmoke } from "./smoke-helpers.mjs";

const tempRoot = mkdtempSync(join(tmpdir(), "lunatest-consumer-pack-"));
const tarballsDir = join(tempRoot, "tarballs");
const consumerDir = join(tempRoot, "consumer");

try {
  mkdirSync(tarballsDir, { recursive: true });
  mkdirSync(consumerDir, { recursive: true });

  const tarballs = stablePackages.map((pkg) => ({
    name: pkg.name,
    tarball: packPackage(resolve(process.cwd(), pkg.dir), tarballsDir),
  }));

  const workspaceOverrides = formatWorkspaceOverrides(createTarballOverrides(tarballs));

  writeFileSync(
    join(consumerDir, "package.json"),
    JSON.stringify(
      {
        name: "lunatest-consumer-smoke-pack",
        private: true,
        type: "module",
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(consumerDir, "pnpm-workspace.yaml"),
    `packages:
  - "."

minimumReleaseAge: 10080
blockExoticSubdeps: true

overrides:
${workspaceOverrides}
`,
  );

  run("pnpm", ["add", ...packageNames(stablePackages)], consumerDir, {
    stdio: "inherit",
  });

  writeFileSync(
    join(consumerDir, "smoke.mjs"),
    `
import { loadLunaConfig, executeLuaScenario } from "@lunatest/core";
import { bootstrapLunaRuntime } from "@lunatest/react";
import { setRouteMocks } from "@lunatest/runtime-intercept";
import { createMcpServer } from "@lunatest/mcp";
import { loadLunaConfig as loadLunaConfigBrowser } from "@lunatest/core/browser";

if (typeof loadLunaConfig !== "function") throw new Error("loadLunaConfig export missing");
if (typeof loadLunaConfigBrowser !== "function") throw new Error("browser loadLunaConfig export missing");
if (typeof executeLuaScenario !== "function") throw new Error("executeLuaScenario export missing");
if (typeof bootstrapLunaRuntime !== "function") throw new Error("bootstrapLunaRuntime export missing");
if (typeof setRouteMocks !== "function") throw new Error("setRouteMocks export missing");
if (typeof createMcpServer !== "function") throw new Error("createMcpServer export missing");
`,
  );

  run("node", ["./smoke.mjs"], consumerDir, { stdio: "inherit" });
  run("pnpm", ["exec", "lunatest", "doctor"], consumerDir, { stdio: "inherit" });
  startMcpSmoke(consumerDir);

  const lockfile = readFileSync(join(consumerDir, "pnpm-lock.yaml"), "utf8");
  if (!lockfile.includes("@lunatest/runtime-intercept")) {
    throw new Error("runtime-intercept package install not found in consumer lockfile");
  }

  process.stdout.write("[consumer-smoke:pack] OK\n");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
