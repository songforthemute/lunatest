export const repositoryUrl = "https://github.com/songforthemute/lunatest";

export const stablePackages = [
  { name: "@lunatest/contracts", dir: "packages/contracts", tag: "latest" },
  { name: "@lunatest/core", dir: "packages/core", tag: "latest" },
  { name: "@lunatest/runtime-intercept", dir: "packages/runtime-intercept", tag: "latest" },
  { name: "@lunatest/cli", dir: "packages/cli", tag: "latest" },
  { name: "@lunatest/react", dir: "packages/react", tag: "latest" },
  { name: "@lunatest/mcp", dir: "packages/mcp", tag: "latest" },
];

export const nextPackages = [
  { name: "@lunatest/vitest-plugin", dir: "packages/vitest-plugin", tag: "next" },
  { name: "@lunatest/playwright-plugin", dir: "packages/playwright-plugin", tag: "next" },
];

export const publicPackages = [...stablePackages, ...nextPackages];

export function packageNames(packages) {
  return packages.map((pkg) => pkg.name);
}
