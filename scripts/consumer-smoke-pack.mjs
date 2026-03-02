import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const stablePackages = [
  { name: "@lunatest/contracts", dir: "packages/contracts" },
  { name: "@lunatest/core", dir: "packages/core" },
  { name: "@lunatest/runtime-intercept", dir: "packages/runtime-intercept" },
  { name: "@lunatest/cli", dir: "packages/cli" },
  { name: "@lunatest/react", dir: "packages/react" },
  { name: "@lunatest/mcp", dir: "packages/mcp" },
];

function run(command, args, cwd, options = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
    ...options,
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    throw new Error(
      [
        `Command failed: ${command} ${args.join(" ")}`,
        stdout ? `stdout:\n${stdout}` : "",
        stderr ? `stderr:\n${stderr}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return typeof result.stdout === "string" ? result.stdout.trim() : "";
}

function packPackage(packageDir, outputDir) {
  const output = run(
    "pnpm",
    ["pack", "--pack-destination", outputDir],
    packageDir,
  );
  const lines = output.split("\n").map((line) => line.trim()).filter(Boolean);
  const tarballPath = lines
    .slice()
    .reverse()
    .find((line) => line.endsWith(".tgz"));

  if (!tarballPath) {
    throw new Error(`Unexpected pnpm pack output: ${packageDir}`);
  }

  return resolve(tarballPath);
}

function startMcpSmoke(consumerDir) {
  const result = spawnSync("pnpm", ["exec", "lunatest-mcp"], {
    cwd: consumerDir,
    encoding: "utf8",
    stdio: "pipe",
    timeout: 800,
  });

  if (result.error && result.error.code === "ETIMEDOUT") {
    return;
  }

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    throw new Error(stderr || "lunatest-mcp smoke failed");
  }
}

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

  const overrides = Object.fromEntries(
    tarballs.map((pkg) => [pkg.name, `file:${pkg.tarball}`]),
  );

  writeFileSync(
    join(consumerDir, "package.json"),
    JSON.stringify(
      {
        name: "lunatest-consumer-smoke-pack",
        private: true,
        type: "module",
        pnpm: {
          overrides,
        },
      },
      null,
      2,
    ),
  );

  run("pnpm", ["add", ...stablePackages.map((pkg) => pkg.name)], consumerDir, {
    stdio: "inherit",
  });

  writeFileSync(
    join(consumerDir, "smoke.mjs"),
    `
import { loadLunaConfig, executeLuaScenario } from "@lunatest/core";
import { bootstrapLunaRuntime } from "@lunatest/react";
import { setRouteMocks } from "@lunatest/runtime-intercept";
import { createMcpServer } from "@lunatest/mcp";

if (typeof loadLunaConfig !== "function") throw new Error("loadLunaConfig export missing");
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
