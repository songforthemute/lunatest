import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function countOccurrences(source, needle) {
  return source.split(needle).length - 1;
}

function getWorkflowJob(workflow, jobName) {
  const jobHeader = `  ${jobName}:\n`;
  const start = workflow.indexOf(jobHeader);

  assert.notEqual(start, -1, `CI workflow should define the ${jobName} job`);

  const bodyStart = start + jobHeader.length;
  const nextJobOffset = workflow.slice(bodyStart).search(/^  [A-Za-z0-9_-]+:\n/m);

  return workflow.slice(start, nextJobOffset === -1 ? workflow.length : bodyStart + nextJobOffset);
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
    pkg.scripts["test:browser"],
    "pnpm --filter @lunatest/e2e-tests test:browser",
  );
  assert.equal(
    pkg.scripts["test:browser:ci"],
    "pnpm run build:workspace:ci && pnpm test:browser",
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
  assert.match(ciWorkflow, /pnpm run test:browser:ci/);
  assert.match(ciWorkflow, /pnpm run perf:regression:ci/);
  assert.doesNotMatch(ciWorkflow, /pnpm -r --filter=!@lunatest\/e2e-tests build/);
  assert.doesNotMatch(ciWorkflow, /pnpm -r --filter=!@lunatest\/e2e-tests lint/);
  assert.doesNotMatch(ciWorkflow, /pnpm -r --filter=!@lunatest\/e2e-tests test/);
  assert.match(benchmarkWorkflow, /pnpm run perf:absolute:ci/);
  assert.match(benchmarkWorkflow, /pnpm run test:e2e:extended:ci/);
});

test("CI runs the Chromium scenario integration on Linux only", async () => {
  const ciWorkflow = await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
  const browserJob = getWorkflowJob(ciWorkflow, "browser-scenario");

  assert.match(
    browserJob,
    /^  browser-scenario:\n    runs-on: ubuntu-latest\n    needs: quality\n/m,
  );
  assert.match(browserJob, /pnpm install --frozen-lockfile/);
  assert.match(
    browserJob,
    /pnpm --filter @lunatest\/e2e-tests exec playwright install --with-deps chromium/,
  );
  assert.match(browserJob, /pnpm run test:browser:ci/);
});

test("CI enforces and uploads the packed external consumer proof", async () => {
  const ciWorkflow = await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
  const proofJob = getWorkflowJob(ciWorkflow, "external-consumer-proof-pack");

  assert.match(
    proofJob,
    /^  external-consumer-proof-pack:\n    runs-on: ubuntu-latest\n    needs: quality\n/m,
  );
  assert.match(
    proofJob,
    /pnpm --filter @lunatest\/e2e-tests exec playwright install --with-deps chromium/,
  );
  assert.match(proofJob, /pnpm quickstart:wagmi:validate -- --enforce-ci-budget/);
  assert.match(proofJob, /if: always\(\)[\s\S]*actions\/upload-artifact@v7\.0\.1/);
  assert.match(proofJob, /path: artifacts\/external-consumer-proof\/pack\.json/);
  assert.match(proofJob, /if-no-files-found: error/);
});

test("CI preserves pull request and main push triggers", async () => {
  const ciWorkflow = await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");

  assert.match(ciWorkflow, /^  pull_request:\s*$/m);
  assert.match(ciWorkflow, /^  push:\n    branches:\n      - main\n/m);
});

test("CI runs packed consumer smoke on all supported desktop platforms", async () => {
  const ciWorkflow = await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
  const linuxJob = getWorkflowJob(ciWorkflow, "consumer-smoke-pack");
  const performanceJob = getWorkflowJob(ciWorkflow, "performance-regression");

  assert.match(linuxJob, /^  consumer-smoke-pack:\n    runs-on: ubuntu-latest\n    needs: quality\n/m);
  assert.match(
    performanceJob,
    /^  performance-regression:\n    if: github\.event_name == 'pull_request' \|\| github\.event_name == 'push'\n    runs-on: ubuntu-latest\n    needs: \[quality, consumer-smoke-pack, e2e-smoke\]\n/m,
  );
  assert.doesNotMatch(performanceJob, /consumer-smoke-pack-(?:windows|macos)/);

  for (const [jobName, runner] of [
    ["consumer-smoke-pack-windows", "windows-latest"],
    ["consumer-smoke-pack-macos", "macos-latest"],
  ]) {
    const job = getWorkflowJob(ciWorkflow, jobName);

    assert.match(
      job,
      new RegExp(
        `^  ${jobName}:\\n    if: github\\.event_name == 'pull_request' \\|\\| github\\.ref == 'refs/heads/main'\\n    runs-on: ${runner}\\n    needs: quality\\n`,
        "m",
      ),
    );
    assert.match(job, /actions\/checkout@v6\.0\.2/);
    assert.match(job, /pnpm\/action-setup@v6\.0\.8/);
    assert.match(job, /version: 10\.33\.4/);
    assert.match(job, /actions\/setup-node@v6\.4\.0/);
    assert.match(job, /node-version: 24/);
    assert.match(job, /cache: pnpm/);
    assert.match(job, /pnpm install --frozen-lockfile/);
    assert.match(job, /pnpm run build:workspace:ci/);
    assert.match(job, /pnpm consumer-smoke:pack/);
  }
});

test("merge-critical workflows expose manual dispatch fallback", async () => {
  const workflows = [
    ["CI", "../.github/workflows/ci.yml"],
    ["Docs", "../.github/workflows/docs.yml"],
    ["Release", "../.github/workflows/release.yml"],
  ];

  for (const [name, workflowPath] of workflows) {
    const workflow = await readFile(new URL(workflowPath, import.meta.url), "utf8");

    assert.match(
      workflow,
      /^  workflow_dispatch:\s*$/m,
      `${name} workflow should allow manual dispatch after merge automation suppression`,
    );
  }
});

test("Docs workflow tracks runnable documentation examples", async () => {
  const docsWorkflow = await readFile(
    new URL("../.github/workflows/docs.yml", import.meta.url),
    "utf8",
  );
  const examplePaths = ["examples/swap-dapp/**", "examples/defi-dashboard/**"];

  for (const examplePath of examplePaths) {
    assert.equal(
      countOccurrences(docsWorkflow, `- "${examplePath}"`),
      2,
      `${examplePath} should trigger both PR and main docs builds`,
    );
  }
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
  assert.match(
    releaseWorkflow,
    /pnpm --filter @lunatest\/e2e-tests exec playwright install --with-deps chromium/,
  );
  assert.match(
    releaseWorkflow,
    /pnpm consumer-proof:registry -- --release-package-set --enforce-ci-budget/,
  );
  assert.match(
    releaseWorkflow,
    /if: always\(\) && steps\.registry-proof\.outcome != 'skipped'[\s\S]*actions\/upload-artifact@v7\.0\.1/,
  );
  assert.match(releaseWorkflow, /path: artifacts\/external-consumer-proof\/registry\.json/);
  assert.doesNotMatch(releaseWorkflow, /pnpm consumer-smoke:npm:next/);
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
