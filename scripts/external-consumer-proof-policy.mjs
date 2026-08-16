import { readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";

const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isInside(parent, candidate) {
  const parentPath = realpathSync(parent);
  const candidatePath = realpathSync(candidate);
  const pathFromParent = relative(parentPath, candidatePath);
  return pathFromParent === "" || (!pathFromParent.startsWith(`..${sep}`) && pathFromParent !== ".." && !isAbsolute(pathFromParent));
}

function listSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name === "dist") {
      return [];
    }

    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return listSourceFiles(path);
    }
    return SOURCE_EXTENSIONS.has(extname(entry.name)) ? [path] : [];
  });
}

export function assertExactDependencyPins(manifest) {
  for (const section of ["dependencies", "devDependencies"]) {
    for (const [name, version] of Object.entries(manifest[section] ?? {})) {
      if (!EXACT_VERSION.test(version)) {
        throw new Error(`${name} in ${section} must use an exact version, received ${version}`);
      }
    }
  }
}

export function assertFixtureSourceIsolation(fixtureDir, repositoryRoot) {
  for (const file of listSourceFiles(fixtureDir)) {
    const contents = readFileSync(file, "utf8");
    if (contents.includes(repositoryRoot) || /(?:\.\.\/)+(?:packages|examples)\//.test(contents)) {
      throw new Error(`Fixture source reaches into the LunaTest repository: ${file}`);
    }

    const importPattern = /(?:from\s+|import\s*(?:\(\s*)?)["']([^"']+)["']/g;
    for (const match of contents.matchAll(importPattern)) {
      const specifier = match[1];
      if (!specifier?.startsWith(".")) {
        continue;
      }

      const target = resolve(dirname(file), specifier);
      const fromFixture = relative(fixtureDir, target);
      if (fromFixture === ".." || fromFixture.startsWith(`..${sep}`) || isAbsolute(fromFixture)) {
        throw new Error(`Fixture import escapes its root: ${file} -> ${specifier}`);
      }
    }
  }
}

export function assertResolutionIsolation({
  lane,
  lockfile,
  workspaceConfig,
  consumerDir,
  tarballsDir,
  repositoryRoot,
  expectedTarballOverrides,
}) {
  const combined = `${lockfile}\n${workspaceConfig}`;
  for (const forbidden of ["workspace:", "link:", repositoryRoot]) {
    if (combined.includes(forbidden)) {
      throw new Error(`${lane} lane contains forbidden resolution marker: ${forbidden}`);
    }
  }

  if (lane === "registry") {
    const hasFileResolution =
      workspaceConfig.includes("file:") ||
      /^(?!\s*excludeLinksFromLockfile:).*file:/m.test(lockfile);
    if (hasFileResolution) {
      throw new Error("registry lane contains forbidden resolution marker: file:");
    }
    for (const forbidden of [".tgz", "overrides:"]) {
      if (combined.includes(forbidden)) {
        throw new Error(`registry lane contains forbidden resolution marker: ${forbidden}`);
      }
    }
    return;
  }

  if (lane !== "pack") {
    throw new Error(`Unsupported external consumer proof lane: ${lane}`);
  }

  if (!expectedTarballOverrides || Object.keys(expectedTarballOverrides).length === 0) {
    throw new Error("pack lane must declare every expected LunaTest tarball override");
  }

  const fileLocators = [...combined.matchAll(/file:([^\s'",}\]]+)/g)].map(
    (match) => `file:${match[1].split("(")[0]}`,
  );
  if (fileLocators.length === 0) {
    throw new Error("pack lane must resolve LunaTest packages from staged tarballs");
  }

  for (const locator of fileLocators) {
    const target = resolve(consumerDir, locator.slice("file:".length));
    if (extname(target) !== ".tgz" || !isInside(tarballsDir, target)) {
      throw new Error(`pack lane file resolution is not a staged tarball: ${locator}`);
    }
  }

  const expectedLocators = new Set(Object.values(expectedTarballOverrides));
  const actualLocators = new Set(fileLocators);
  if (
    expectedLocators.size !== actualLocators.size ||
    [...expectedLocators].some((locator) => !actualLocators.has(locator))
  ) {
    throw new Error("pack lane tarball locators do not match the staged package set");
  }

  for (const [packageName, locator] of Object.entries(expectedTarballOverrides)) {
    const expectedOverride = `${JSON.stringify(packageName)}: ${JSON.stringify(locator)}`;
    if (!workspaceConfig.includes(expectedOverride)) {
      throw new Error(`pack lane is missing the staged override for ${packageName}`);
    }
    const importerResolution = new RegExp(
      `${escapeRegExp(packageName)}["']?:[\\s\\S]{0,240}${escapeRegExp(locator)}`,
    );
    if (!importerResolution.test(lockfile)) {
      throw new Error(`pack lane lockfile does not resolve ${packageName} to its staged tarball`);
    }
    const registrySnapshot = new RegExp(
      `^\\s{2}["']?${escapeRegExp(packageName)}@\\d`,
      "m",
    );
    if (registrySnapshot.test(lockfile)) {
      throw new Error(`pack lane lockfile contains a registry fallback for ${packageName}`);
    }
  }
}

export function assertInstalledPackageIsolation({
  consumerDir,
  packageNames,
  repositoryRoot,
}) {
  for (const packageName of packageNames) {
    const packageRoot = join(consumerDir, "node_modules", ...packageName.split("/"));
    if (!statSync(packageRoot).isDirectory()) {
      throw new Error(`Installed package is missing: ${packageName}`);
    }

    if (!isInside(consumerDir, packageRoot)) {
      throw new Error(`Installed package resolves outside the consumer: ${packageName}`);
    }
    if (isInside(repositoryRoot, packageRoot)) {
      throw new Error(`Installed package resolves to repository source: ${packageName}`);
    }
  }
}
