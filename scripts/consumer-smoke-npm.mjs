import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const stablePackages = [
  "@lunatest/contracts",
  "@lunatest/core",
  "@lunatest/runtime-intercept",
  "@lunatest/cli",
  "@lunatest/react",
  "@lunatest/mcp",
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

const tagArg = process.argv.find((arg) => arg.startsWith("--tag="));
const tag = tagArg ? tagArg.slice("--tag=".length) : "latest";
const tempRoot = mkdtempSync(join(tmpdir(), "lunatest-consumer-npm-"));

try {
  writeFileSync(
    join(tempRoot, "package.json"),
    JSON.stringify(
      {
        name: "lunatest-consumer-smoke-npm",
        private: true,
        type: "module",
      },
      null,
      2,
    ),
  );

  const installTargets = stablePackages.map((name) => `${name}@${tag}`);
  run("pnpm", ["add", ...installTargets], tempRoot, {
    stdio: "inherit",
  });

  writeFileSync(
    join(tempRoot, "smoke.mjs"),
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

  run("node", ["./smoke.mjs"], tempRoot, { stdio: "inherit" });
  run("pnpm", ["exec", "lunatest", "doctor"], tempRoot, { stdio: "inherit" });
  startMcpSmoke(tempRoot);
  process.stdout.write(`[consumer-smoke:npm] OK (tag=${tag})\n`);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
