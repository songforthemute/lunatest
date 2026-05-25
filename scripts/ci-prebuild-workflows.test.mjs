import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

test("package.json exposes CI wrapper scripts", async () => {
  const pkg = await readJson(new URL("../package.json", import.meta.url));

  assert.equal(
    pkg.scripts["build:workspace:ci"],
    "pnpm -r --filter=!lunatest --filter=!@lunatest/e2e-tests --if-present run build",
  );
  assert.equal(
    pkg.scripts["lint:workspace:ci"],
    "pnpm -r --filter=!lunatest --filter=!@lunatest/e2e-tests --if-present run lint",
  );
  assert.equal(
    pkg.scripts["test:workspace:ci"],
    "pnpm -r --filter=!lunatest --filter=!@lunatest/e2e-tests --if-present run test",
  );
  assert.equal(
    pkg.scripts["test:e2e:smoke:ci"],
    "pnpm run build:workspace:ci && pnpm test:e2e:smoke",
  );
  assert.equal(
    pkg.scripts["test:e2e:extended:ci"],
    "pnpm run build:workspace:ci && pnpm test:e2e:extended",
  );
  assert.equal(
    pkg.scripts["perf:absolute:ci"],
    "pnpm run build:workspace:ci && node scripts/check-performance.mjs --mode=absolute --output=scripts/perf-current-absolute.json",
  );
  assert.equal(
    pkg.scripts["perf:regression:ci"],
    "pnpm run build:workspace:ci && node scripts/check-performance.mjs --mode=regression --baseline=scripts/perf-baseline.json --output=scripts/perf-current.json",
  );
});

test("CI and Benchmark workflows call CI wrapper scripts", async () => {
  const ciWorkflow = await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
  const benchmarkWorkflow = await readFile(
    new URL("../.github/workflows/benchmark.yml", import.meta.url),
    "utf8",
  );

  assert.match(ciWorkflow, /pnpm run build:workspace:ci/);
  assert.match(ciWorkflow, /pnpm run lint:workspace:ci/);
  assert.match(ciWorkflow, /pnpm run test:workspace:ci/);
  assert.match(ciWorkflow, /pnpm run test:e2e:smoke:ci/);
  assert.match(ciWorkflow, /pnpm run perf:regression:ci/);
  assert.doesNotMatch(ciWorkflow, /pnpm -r --filter=!@lunatest\/e2e-tests build/);
  assert.doesNotMatch(ciWorkflow, /pnpm -r --filter=!@lunatest\/e2e-tests lint/);
  assert.doesNotMatch(ciWorkflow, /pnpm -r --filter=!@lunatest\/e2e-tests test/);
  assert.match(benchmarkWorkflow, /pnpm run perf:absolute:ci/);
  assert.match(benchmarkWorkflow, /pnpm run test:e2e:extended:ci/);
});

test("Release workflow runs npm smoke after publish action success", async () => {
  const releaseWorkflow = await readFile(
    new URL("../.github/workflows/release.yml", import.meta.url),
    "utf8",
  );

  assert.match(releaseWorkflow, /if: steps\.changesets\.outputs\.hasChangesets != 'true'/);
  assert.match(releaseWorkflow, /pnpm run build:workspace:ci/);
  assert.match(releaseWorkflow, /pnpm run lint:workspace:ci/);
  assert.match(releaseWorkflow, /pnpm run test:workspace:ci/);
  assert.match(releaseWorkflow, /pnpm consumer-smoke:npm -- --tag=latest/);
  assert.match(releaseWorkflow, /pnpm consumer-smoke:npm:next/);
  assert.doesNotMatch(releaseWorkflow, /pnpm -r lint/);
  assert.doesNotMatch(releaseWorkflow, /pnpm -r build/);
  assert.doesNotMatch(releaseWorkflow, /pnpm -r test/);
  assert.doesNotMatch(
    releaseWorkflow,
    /if: steps\.changesets\.outputs\.published == 'true'\n\s+run: pnpm consumer-smoke:npm/,
  );
});

test("Docs workflow checks GitHub Pages before push deploy", async () => {
  const docsWorkflow = await readFile(
    new URL("../.github/workflows/docs.yml", import.meta.url),
    "utf8",
  );

  assert.match(docsWorkflow, /Ensure GitHub Pages is enabled/);
  assert.match(docsWorkflow, /gh api "repos\/\$\{GITHUB_REPOSITORY\}\/pages"/);
  assert.match(docsWorkflow, /settings\/pages/);
  assert.doesNotMatch(docsWorkflow, /--method POST/);
  assert.doesNotMatch(docsWorkflow, /-f build_type=workflow/);
  assert.match(docsWorkflow, /actions\/deploy-pages@v5\.0\.0/);
});

test("GitHub workflows use Node 24 action runtimes", async () => {
  const workflows = [
    "../.github/workflows/benchmark.yml",
    "../.github/workflows/ci.yml",
    "../.github/workflows/docs.yml",
    "../.github/workflows/release.yml",
  ];
  const expectedActionTags = new Map([
    ["actions/checkout", "v6.0.2"],
    ["actions/setup-node", "v6.4.0"],
    ["actions/upload-artifact", "v7.0.1"],
    ["actions/upload-pages-artifact", "v5.0.0"],
    ["actions/deploy-pages", "v5.0.0"],
    ["pnpm/action-setup", "v6.0.8"],
    ["changesets/action", "v1.8.0"],
  ]);

  for (const workflowPath of workflows) {
    const workflow = await readFile(new URL(workflowPath, import.meta.url), "utf8");
    const usesStatements = workflow.matchAll(/uses:\s*([^\s#]+)/g);

    for (const [, uses] of usesStatements) {
      const [action, tag] = uses.split("@");
      if (!expectedActionTags.has(action)) {
        continue;
      }

      assert.equal(tag, expectedActionTags.get(action), `${workflowPath} uses ${uses}`);
    }
  }
});

test("GitHub workflows use the root package manager pnpm version", async () => {
  const pkg = await readJson(new URL("../package.json", import.meta.url));
  const pnpmVersion = pkg.packageManager.replace(/^pnpm@/, "");
  const workflows = [
    "../.github/workflows/benchmark.yml",
    "../.github/workflows/ci.yml",
    "../.github/workflows/docs.yml",
    "../.github/workflows/release.yml",
  ];
  const escapedPnpmVersion = pnpmVersion.replaceAll(".", "\\.");

  for (const workflowPath of workflows) {
    const workflow = await readFile(new URL(workflowPath, import.meta.url), "utf8");

    assert.match(
      workflow,
      new RegExp(`version:\\s+${escapedPnpmVersion}`),
      `${workflowPath} should install pnpm ${pnpmVersion}`,
    );
    assert.doesNotMatch(
      workflow,
      new RegExp(`version:\\s+(?!${escapedPnpmVersion}\\b)\\d+\\.\\d+\\.\\d+`),
      `${workflowPath} should not pin a different pnpm version`,
    );
  }
});
