import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  fixtureDir,
  parseExternalConsumerProofOptions,
  repositoryRoot,
  runExternalConsumerProof,
} from "./run-external-consumer-proof.mjs";
import { resolveInstalledPackageBin, run } from "./smoke-helpers.mjs";

export const scaffoldPackage = "create-vite@9.1.2";

export function prepareWagmiQuickstart() {
  const rootManifest = JSON.parse(
    readFileSync(join(repositoryRoot, "package.json"), "utf8"),
  );
  assert.equal(
    `create-vite@${rootManifest.devDependencies["create-vite"]}`,
    scaffoldPackage,
  );
  const scaffoldBin = resolveInstalledPackageBin(
    "create-vite",
    "create-vite",
    repositoryRoot,
  );
  const tempRoot = mkdtempSync(join(tmpdir(), "lunatest-wagmi-quickstart-"));
  const targetDir = join(tempRoot, "wagmi-swap");
  try {
    run(
      scaffoldBin.command,
      [...scaffoldBin.args, "wagmi-swap", "--template", "react-ts"],
      tempRoot,
      { shell: scaffoldBin.shell, stdio: "inherit" },
    );

    const scaffoldManifest = JSON.parse(
      readFileSync(join(targetDir, "package.json"), "utf8"),
    );
    assert.equal(scaffoldManifest.dependencies.react, "^19.2.8");
    assert.equal(scaffoldManifest.devDependencies.vite, "^8.2.0");

    cpSync(fixtureDir, targetDir, { recursive: true, force: true });
    return { targetDir, tempRoot };
  } catch (cause) {
    rmSync(tempRoot, { recursive: true, force: true });
    throw cause;
  }
}

export function validateWagmiQuickstart(options = {}) {
  const prepared = prepareWagmiQuickstart();
  try {
    runExternalConsumerProof("pack", {
      ...options,
      fixtureDir: prepared.targetDir,
    });
  } finally {
    rmSync(prepared.tempRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  validateWagmiQuickstart(parseExternalConsumerProofOptions(process.argv.slice(2)));
}
