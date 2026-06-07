import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  createConsumerSmokeScript,
  reactPeerMatrix,
} from "./consumer-smoke-fixtures.mjs";
import { packageNames, publicPackages } from "./package-roster.mjs";
import {
  createTarballOverrides,
  formatWorkspaceOverrides,
} from "./pnpm-workspace-overrides.mjs";
import { packPackage, run, startMcpSmoke } from "./smoke-helpers.mjs";

const tempRoot = mkdtempSync(join(tmpdir(), "lunatest-consumer-pack-"));
const tarballsDir = join(tempRoot, "tarballs");
const consumerDir = join(tempRoot, "consumer");

try {
  mkdirSync(tarballsDir, { recursive: true });

  const tarballs = publicPackages.map((pkg) => ({
    name: pkg.name,
    tarball: packPackage(resolve(process.cwd(), pkg.dir), tarballsDir),
  }));

  const workspaceOverrides = formatWorkspaceOverrides(createTarballOverrides(tarballs));

  for (const reactPeer of reactPeerMatrix) {
    const matrixConsumerDir = join(consumerDir, reactPeer.label);

    mkdirSync(matrixConsumerDir, { recursive: true });

    writeFileSync(
      join(matrixConsumerDir, "package.json"),
      JSON.stringify(
        {
          name: `lunatest-consumer-smoke-pack-${reactPeer.label}`,
          private: true,
          type: "module",
        },
        null,
        2,
      ),
    );

    writeFileSync(
      join(matrixConsumerDir, "pnpm-workspace.yaml"),
      `packages:
  - "."

minimumReleaseAge: 10080
blockExoticSubdeps: true

overrides:
${workspaceOverrides}
`,
    );

    run(
      "pnpm",
      ["add", ...reactPeer.dependencies, ...packageNames(publicPackages)],
      matrixConsumerDir,
      {
        stdio: "inherit",
      },
    );

    writeFileSync(
      join(matrixConsumerDir, "smoke.mjs"),
      createConsumerSmokeScript({ includeNextPackages: true }),
    );

    run("node", ["./smoke.mjs"], matrixConsumerDir, { stdio: "inherit" });
    run("pnpm", ["exec", "lunatest", "doctor"], matrixConsumerDir, { stdio: "inherit" });
    startMcpSmoke(matrixConsumerDir);

    const lockfile = readFileSync(join(matrixConsumerDir, "pnpm-lock.yaml"), "utf8");
    for (const packageName of packageNames(publicPackages)) {
      if (!lockfile.includes(packageName)) {
        throw new Error(`${packageName} package install not found in consumer lockfile`);
      }
    }

    process.stdout.write(`[consumer-smoke:pack] OK (${reactPeer.label})\n`);
  }
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
