import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
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
import {
  createExternalConsumerProofReport,
  loadProofFootprint,
  writeExternalConsumerProofReport,
} from "./external-consumer-proof-report.mjs";

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

export function parseExternalConsumerProofOptions(args) {
  const outputArgument = args.find((argument) => argument.startsWith("--output="));
  return {
    enforceCiBudget: args.includes("--enforce-ci-budget"),
    outputPath: outputArgument?.slice("--output=".length),
  };
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

export function runExternalConsumerProof(lane, options = {}) {
  const sourceFixtureDir = options.fixtureDir
    ? resolve(options.fixtureDir)
    : fixtureDir;
  const tempRoot = mkdtempSync(join(tmpdir(), `lunatest-external-proof-${lane}-`));
  const consumerDir = join(tempRoot, "consumer");
  const proofDir = join(tempRoot, "proof-results");
  const tarballsDir = join(tempRoot, "tarballs");
  const names = packageNames(publicPackages);
  const fixtureManifest = readJson(join(sourceFixtureDir, "package.json"));
  const setupTiming = {
    browserDownloadMs: null,
    consumerBuildAndStaticChecksMs: 0,
    consumerInstallMs: 0,
    playwrightCommandMs: 0,
    vitestCommandMs: 0,
    workspaceBuildAndPackMs: 0,
  };

  try {
    assertExactDependencyPins(fixtureManifest);
    assertFixtureSourceIsolation(sourceFixtureDir, repositoryRoot);
    cpSync(sourceFixtureDir, consumerDir, {
      recursive: true,
      filter(source) {
        return !["node_modules", "dist"].includes(source.split(/[\\/]/).at(-1));
      },
    });

    let expectedTarballOverrides;
    let expectedVersions;
    if (lane === "pack") {
      const workspaceStarted = performance.now();
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
      setupTiming.workspaceBuildAndPackMs = performance.now() - workspaceStarted;
      const installStarted = performance.now();
      run("pnpm", ["install", "--no-frozen-lockfile"], consumerDir, { stdio: "inherit" });
      setupTiming.consumerInstallMs = performance.now() - installStarted;
      expectedVersions = repositoryPackageVersions(publicPackages);
    } else {
      const installStarted = performance.now();
      run("pnpm", ["install", "--frozen-lockfile"], consumerDir, { stdio: "inherit" });
      setupTiming.consumerInstallMs = performance.now() - installStarted;
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

    const staticChecksStarted = performance.now();
    run("pnpm", ["run", "typecheck"], consumerDir, { stdio: "inherit" });
    run("pnpm", ["run", "lint"], consumerDir, { stdio: "inherit" });
    run("pnpm", ["run", "build"], consumerDir, { stdio: "inherit" });
    setupTiming.consumerBuildAndStaticChecksMs = performance.now() - staticChecksStarted;
    if (lane === "pack") {
      const proofEnv = {
        ...process.env,
        LUNATEST_PROOF_DIR: proofDir,
        LUNATEST_PROOF_RUNS: "30",
      };
      let vitestCommandPassed = true;
      const vitestStarted = performance.now();
      try {
        run("pnpm", ["run", "test:vitest"], consumerDir, {
          env: proofEnv,
          stdio: "inherit",
        });
      } catch {
        vitestCommandPassed = false;
      }
      setupTiming.vitestCommandMs = performance.now() - vitestStarted;
      let playwrightCommandPassed = true;
      const playwrightStarted = performance.now();
      try {
        run("pnpm", ["run", "test:browser"], consumerDir, {
          env: proofEnv,
          stdio: "inherit",
        });
      } catch {
        playwrightCommandPassed = false;
      }
      setupTiming.playwrightCommandMs = performance.now() - playwrightStarted;

      const report = createExternalConsumerProofReport({
        commandResults: {
          playwright: playwrightCommandPassed,
          vitest: vitestCommandPassed,
        },
        enforceCiBudget: options.enforceCiBudget ?? false,
        footprint: loadProofFootprint(consumerDir),
        lane,
        packages: Object.entries(expectedVersions).map(([name, version]) => ({
          name,
          source: "packed-tarball",
          version,
        })),
        playwright: readProofFragment(proofDir, "playwright"),
        setupTiming: Object.fromEntries(
          Object.entries(setupTiming).map(([name, value]) => [
            name,
            typeof value === "number" ? Math.round(value * 1000) / 1000 : value,
          ]),
        ),
        vitest: readProofFragment(proofDir, "vitest"),
      });
      const outputPath = resolve(
        repositoryRoot,
        options.outputPath ?? "artifacts/external-consumer-proof/pack.json",
      );
      writeExternalConsumerProofReport(outputPath, report);
      process.stdout.write(`[external-consumer-proof] report=${outputPath}\n`);
      if (!report.passed) {
        throw new Error(`External consumer proof gates failed; see ${outputPath}`);
      }
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

function readProofFragment(proofDir, runner) {
  const path = join(proofDir, `${runner}.json`);
  if (!existsSync(path)) {
    return { measuredRuns: [], runner, warmupRuns: 0 };
  }
  return readJson(path);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  runExternalConsumerProof(
    parseExternalConsumerProofLane(args),
    parseExternalConsumerProofOptions(args),
  );
}
