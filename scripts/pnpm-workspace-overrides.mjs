import { isAbsolute, relative } from "node:path";

export function createTarballOverrides(
  tarballs,
  workspaceDir,
  relativePath = relative,
  isAbsolutePath = isAbsolute,
) {
  return Object.fromEntries(
    tarballs.map((pkg) => {
      const workspaceRelativePath = relativePath(workspaceDir, pkg.tarball);
      if (isAbsolutePath(workspaceRelativePath)) {
        throw new Error(
          `Tarball override for ${pkg.name} must be relative to the consumer workspace`,
        );
      }

      return [
        pkg.name,
        `file:${workspaceRelativePath.replaceAll("\\", "/")}`,
      ];
    }),
  );
}

export function formatWorkspaceOverrides(overrides) {
  return Object.entries(overrides)
    .map(([name, target]) => `  ${JSON.stringify(name)}: ${JSON.stringify(target)}`)
    .join("\n");
}

export function createRegistryConsumerWorkspaceConfig(packageNames) {
  const exclusions = [...new Set(packageNames)]
    .map((packageName) => `  - ${JSON.stringify(packageName)}`)
    .join("\n");

  // 방금 publish한 LunaTest 패키지만 age gate를 우회하고 서드파티 정책은 유지한다.
  return `packages:
  - "."

minimumReleaseAge: 10080
minimumReleaseAgeExclude:
${exclusions}
blockExoticSubdeps: true
`;
}
