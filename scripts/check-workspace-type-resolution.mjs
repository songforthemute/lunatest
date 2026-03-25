import { mkdir, rename, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const repoRoot = path.resolve(new URL(".", import.meta.url).pathname, "..");

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: process.env,
    });

    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

async function canAccess(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function listWorkspaceDistDirs() {
  const packagesDir = path.join(repoRoot, "packages");
  const entries = await (await import("node:fs/promises")).readdir(packagesDir, {
    withFileTypes: true,
  });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(packagesDir, entry.name, "dist"));
}

async function moveAway(targetPath, backupRoot) {
  if (!(await canAccess(targetPath))) {
    return null;
  }

  const relative = path.relative(repoRoot, targetPath);
  const backupPath = path.join(backupRoot, relative);
  await mkdir(path.dirname(backupPath), { recursive: true });
  await rename(targetPath, backupPath);
  return { targetPath, backupPath };
}

async function restoreAll(backups) {
  for (const backup of backups.reverse()) {
    await mkdir(path.dirname(backup.targetPath), { recursive: true });
    await rename(backup.backupPath, backup.targetPath);
  }
}

async function main() {
  const backupRoot = await (await import("node:fs/promises")).mkdtemp(
    path.join(tmpdir(), "lunatest-workspace-types-"),
  );
  const backups = [];

  try {
    for (const distDir of await listWorkspaceDistDirs()) {
      const backup = await moveAway(distDir, backupRoot);
      if (backup) {
        backups.push(backup);
      }
    }

    const exitCode = await run("pnpm", ["-r", "lint"], repoRoot);
    if (exitCode !== 0) {
      process.exitCode = exitCode;
    }
  } finally {
    await restoreAll(backups);
    await rm(backupRoot, { recursive: true, force: true });
  }
}

await main();
