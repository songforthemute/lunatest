import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { publicPackages, repositoryUrl } from "./package-roster.mjs";
import { packPackage, run } from "./smoke-helpers.mjs";

const disallowedPathPatterns = [
  /^src\//,
  /^docs\//,
  /^scripts\//,
  /^\.github\//,
  /^\.worktrees\//,
];

function getTarballFiles(tarballPath) {
  const output = run("tar", ["-tf", tarballPath], process.cwd());
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^package\//, ""));
}

function getTarballManifest(tarballPath) {
  return JSON.parse(run("tar", ["-xOf", tarballPath, "package/package.json"], process.cwd()));
}

function validatePackFiles(packageDir, files, manifest) {
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

  if (manifest.repository?.type !== "git") {
    errors.push("repository.type은 git이어야 함");
  }

  if (manifest.repository?.url !== repositoryUrl) {
    errors.push(`repository.url은 ${repositoryUrl}이어야 함`);
  }

  if (manifest.repository?.directory !== packageDir) {
    errors.push(`repository.directory는 ${packageDir}이어야 함`);
  }

  return errors;
}

const failures = [];
const tempDir = mkdtempSync(join(tmpdir(), "lunatest-pack-check-"));

try {
  for (const { dir: packageDir } of publicPackages) {
    const absoluteDir = join(process.cwd(), packageDir);
    const tarballPath = packPackage(absoluteDir, tempDir);
    const files = getTarballFiles(tarballPath);
    const manifest = getTarballManifest(tarballPath);
    const errors = validatePackFiles(packageDir, files, manifest);

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
