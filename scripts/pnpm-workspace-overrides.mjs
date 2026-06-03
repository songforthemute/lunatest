import { pathToFileURL } from "node:url";

export function createTarballOverrides(tarballs) {
  return Object.fromEntries(
    tarballs.map((pkg) => [pkg.name, pathToFileURL(pkg.tarball).href]),
  );
}

export function formatWorkspaceOverrides(overrides) {
  return Object.entries(overrides)
    .map(([name, target]) => `  ${JSON.stringify(name)}: ${JSON.stringify(target)}`)
    .join("\n");
}
