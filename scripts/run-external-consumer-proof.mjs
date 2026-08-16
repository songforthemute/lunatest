import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertExactDependencyPins,
  assertFixtureSourceIsolation,
  assertInstalledPackageIsolation,
  assertResolutionIsolation,
} from "./external-consumer-proof-policy.mjs";
import { packageNames, publicPackages } from "./package-roster.mjs";
import {
  createTarballOverrides,
  formatWorkspaceOverrides,
} from "./pnpm-workspace-overrides.mjs";
import {
  assertInstalledPackageVersions,
  packPackage,
  run,
} from "./smoke-helpers.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = resolve(scriptDir, "..");
export const fixtureDir = join(repositoryRoot, "consumer-proof", "wagmi-swap");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function parseExternalConsumerProofLane(args) {
  const laneArgument = args.find((argument) => argument.startsWith("--lane="));
  const lane = laneArgument?.slice("--lane=".length) ?? "pack";
  if (lane !== "pack" && lane !== "registry") {
    throw new Error(`Unsupported external consumer proof lane: ${lane}`);
  }
  return lane;
}

function fixturePackageVersions(manifest, names) {
  return Object.fromEntries(
    names.map((name) => {
      const version = manifest.dependencies?.[name] ?? manifest.devDependencies?.[name];
      if (typeof version !== "string") {
        throw new Error(`Fixture does not record a version for ${name}`);
      }
      return [name, version];
    }),
  );
}

function repositoryPackageVersions(packages) {
  return Object.fromEntries(
    packages.map((pkg) => {
      const manifest = readJson(join(repositoryRoot, pkg.dir, "package.json"));
      return [pkg.name, manifest.version];
    }),
  );
}

function packWorkspaceConfig(overrides) {
  const formattedOverrides = formatWorkspaceOverrides(overrides);
  return `packages:
  - "."

minimumReleaseAge: 10080
minimumReleaseAgeExclude:
${packageNames(publicPackages).map((name) => `  - ${JSON.stringify(name)}`).join("\n")}
blockExoticSubdeps: true

overrides:
${formattedOverrides}
`;
}

export function runExternalConsumerProof(lane) {
  const tempRoot = mkdtempSync(join(tmpdir(), `lunatest-external-proof-${lane}-`));
  const consumerDir = join(tempRoot, "consumer");
  const tarballsDir = join(tempRoot, "tarballs");
  const names = packageNames(publicPackages);
  const fixtureManifest = readJson(join(fixtureDir, "package.json"));

  try {
    assertExactDependencyPins(fixtureManifest);
    assertFixtureSourceIsolation(fixtureDir, repositoryRoot);
    cpSync(fixtureDir, consumerDir, {
      recursive: true,
      filter(source) {
        return !["node_modules", "dist"].includes(source.split(/[\\/]/).at(-1));
      },
    });

    let expectedTarballOverrides;
    let expectedVersions;
    if (lane === "pack") {
      run("pnpm", ["run", "build:workspace:ci"], repositoryRoot, { stdio: "inherit" });
      mkdirSync(tarballsDir, { recursive: true });
      const tarballs = publicPackages.map((pkg) => ({
        name: pkg.name,
        tarball: packPackage(join(repositoryRoot, pkg.dir), tarballsDir),
      }));
      expectedTarballOverrides = createTarballOverrides(tarballs, consumerDir);
      writeFileSync(
        join(consumerDir, "pnpm-workspace.yaml"),
        packWorkspaceConfig(expectedTarballOverrides),
      );
      run("pnpm", ["install", "--no-frozen-lockfile"], consumerDir, { stdio: "inherit" });
      expectedVersions = repositoryPackageVersions(publicPackages);
    } else {
      run("pnpm", ["install", "--frozen-lockfile"], consumerDir, { stdio: "inherit" });
      expectedVersions = fixturePackageVersions(fixtureManifest, names);
    }

    const lockfile = readFileSync(join(consumerDir, "pnpm-lock.yaml"), "utf8");
    const workspaceConfig = readFileSync(join(consumerDir, "pnpm-workspace.yaml"), "utf8");
    assertResolutionIsolation({
      lane,
      lockfile,
      workspaceConfig,
      consumerDir,
      tarballsDir,
      repositoryRoot,
      expectedTarballOverrides,
    });
    assertInstalledPackageIsolation({ consumerDir, packageNames: names, repositoryRoot });
    assertInstalledPackageVersions(consumerDir, expectedVersions);

    run("pnpm", ["run", "typecheck"], consumerDir, { stdio: "inherit" });
    run("pnpm", ["run", "lint"], consumerDir, { stdio: "inherit" });
    run("pnpm", ["run", "build"], consumerDir, { stdio: "inherit" });
    if (lane === "pack") {
      run("pnpm", ["run", "test:vitest"], consumerDir, { stdio: "inherit" });
      run("pnpm", ["run", "test:browser"], consumerDir, { stdio: "inherit" });
    }

    process.stdout.write(
      `[external-consumer-proof] OK lane=${lane} packages=${names.length}\n`,
    );
  } finally {
    if (process.env.LUNATEST_KEEP_PROOF_TEMP === "1") {
      process.stdout.write(`[external-consumer-proof] kept ${tempRoot}\n`);
    } else {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runExternalConsumerProof(parseExternalConsumerProofLane(process.argv.slice(2)));
}
