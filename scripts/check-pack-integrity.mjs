import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const packageDirs = [
  "packages/contracts",
  "packages/core",
  "packages/runtime-intercept",
  "packages/cli",
  "packages/react",
  "packages/mcp",
  "packages/vitest-plugin",
  "packages/playwright-plugin",
];

const disallowedPathPatterns = [
  /^src\//,
  /^docs\//,
  /^scripts\//,
  /^\.github\//,
  /^\.worktrees\//,
];

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
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

  return result.stdout.trim();
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
    throw new Error(`Tarball path not found from pnpm pack output at ${packageDir}`);
  }

  return resolve(tarballPath);
}

function getTarballFiles(tarballPath) {
  const output = run("tar", ["-tf", tarballPath], process.cwd());
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^package\//, ""));
}

function validatePackFiles(packageDir, files) {
  const errors = [];

  if (!files.includes("package.json")) {
    errors.push("package.json 누락");
  }

  if (!files.some((file) => file.startsWith("dist/"))) {
    errors.push("dist 산출물 누락");
  }

  for (const file of files) {
    if (disallowedPathPatterns.some((pattern) => pattern.test(file))) {
      errors.push(`허용되지 않은 파일 포함: ${file}`);
    }
  }

  return errors;
}

const failures = [];
const tempDir = mkdtempSync(join(tmpdir(), "lunatest-pack-check-"));

try {
  for (const packageDir of packageDirs) {
    const absoluteDir = join(process.cwd(), packageDir);
    const tarballPath = packPackage(absoluteDir, tempDir);
    const files = getTarballFiles(tarballPath);
    const errors = validatePackFiles(packageDir, files);

    if (errors.length > 0) {
      failures.push({
        packageDir,
        errors,
      });
      continue;
    }

    process.stdout.write(
      `[pack-integrity] ${packageDir}: OK (${files.length} files)\n`,
    );
  }
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

if (failures.length > 0) {
  for (const failure of failures) {
    process.stderr.write(`[pack-integrity] ${failure.packageDir}\n`);
    for (const error of failure.errors) {
      process.stderr.write(`  - ${error}\n`);
    }
  }
  process.exitCode = 1;
}
