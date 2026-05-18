import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

export function run(command, args, cwd, options = {}) {
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

export function packPackage(packageDir, outputDir) {
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
    throw new Error(`Tarball path not found from pnpm pack output at ${packageDir}`);
  }

  return resolve(tarballPath);
}

export function startMcpSmoke(consumerDir) {
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
