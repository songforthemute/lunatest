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
    "pnpm -r --filter=!@lunatest/e2e-tests build",
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

  assert.match(ciWorkflow, /pnpm run test:e2e:smoke:ci/);
  assert.match(ciWorkflow, /pnpm run perf:regression:ci/);
  assert.match(benchmarkWorkflow, /pnpm run perf:absolute:ci/);
  assert.match(benchmarkWorkflow, /pnpm run test:e2e:extended:ci/);
});
