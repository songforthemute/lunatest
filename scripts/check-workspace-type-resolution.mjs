import { mkdir, mkdtemp, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

export function resolveRepoRootFromScriptUrl(scriptUrl) {
  return path.resolve(path.dirname(fileURLToPath(scriptUrl)), "..");
}

export function buildBackupPath(targetPath, repoRoot, backupRoot) {
  const relative = path.relative(repoRoot, targetPath);
  return path.join(backupRoot, relative);
}

const repoRoot = resolveRepoRootFromScriptUrl(import.meta.url);

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

  const backupPath = buildBackupPath(targetPath, repoRoot, backupRoot);
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
  const backupParent = path.join(repoRoot, "node_modules", ".cache");
  await mkdir(backupParent, { recursive: true });
  const backupRoot = await mkdtemp(path.join(backupParent, "lunatest-workspace-types-"));
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

const directInvocation =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (directInvocation) {
  await main();
}
