import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { publicPackages } from "./package-roster.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function assertExists(relativePath) {
  assert.equal(existsSync(path.join(ROOT, relativePath)), true, relativePath);
}

function bashBlocks(source) {
  return [...source.matchAll(/```bash\n([\s\S]*?)```/g)].map((match) => match[1]);
}

function luaBlocks(source) {
  return [...source.matchAll(/```lua\n([\s\S]*?)```/g)].map((match) => match[1]);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("consumer installation snippets do not pin stable packages to a prerelease channel", () => {
  const documents = [
    "README.md",
    "README.ko.md",
    "docs/getting-started.md",
    "docs/ko/getting-started.md",
    "docs/guides/library-consumption.md",
    "docs/ko/guides/library-consumption.md",
    "docs/guides/wagmi-swap-quickstart.md",
    "docs/ko/guides/wagmi-swap-quickstart.md",
  ];

  for (const document of documents) {
    for (const block of bashBlocks(read(document))) {
      for (const pkg of publicPackages) {
        const specifiers = block.match(
          new RegExp(`${escapeRegExp(pkg.name)}(?:@[^\\s]+)?`, "g"),
        ) ?? [];

        for (const specifier of specifiers) {
          assert.doesNotMatch(specifier, /@next$/, `${document}: ${specifier}`);
        }
      }
    }
  }
});

test("every public package has English and Korean API references", () => {
  const packageToPage = new Map([
    ["@lunatest/contracts", "contracts"],
    ["@lunatest/core", "core"],
    ["@lunatest/runtime-intercept", "runtime-intercept"],
    ["@lunatest/cli", "cli"],
    ["@lunatest/react", "react"],
    ["@lunatest/mcp", "mcp"],
    ["@lunatest/vitest-plugin", "vitest-plugin"],
    ["@lunatest/playwright-plugin", "playwright-plugin"],
  ]);

  assert.deepEqual([...packageToPage.keys()], publicPackages.map((pkg) => pkg.name));

  for (const [packageName, page] of packageToPage) {
    for (const document of [`docs/api/${page}.md`, `docs/ko/api/${page}.md`]) {
      assertExists(document);
      assert.match(read(document), new RegExp(`^# API: ${escapeRegExp(packageName)}$`, "m"), document);
    }
  }
});

test("CLI references document every registered command", () => {
  const commandSource = read("packages/cli/src/cli.ts");
  const commands = [...commandSource.matchAll(/\.command\("([^"]+)"\)/g)].map(
    (match) => match[1],
  );

  for (const document of ["docs/api/cli.md", "docs/ko/api/cli.md"]) {
    const source = read(document);
    for (const command of commands) {
      assert.match(source, new RegExp(`\\\`${command}\\\``), `${document}: ${command}`);
    }
  }
});

test("Core references document project and deterministic runner helpers", () => {
  const names = [
    "loadLunaProjectConfig",
    "loadLunaProjectScenarios",
    "resolveLunaScenarioSources",
    "listLunaProjectScenarios",
    "runLunaProjectScenario",
    "runAllLunaProjectScenarios",
    "applyInterceptState",
    "setRouteMocks",
    "createDeterministicScenarioAdapter",
  ];

  for (const document of ["docs/api/core.md", "docs/ko/api/core.md"]) {
    const source = read(document);
    for (const name of names) {
      assert.match(source, new RegExp(`\\\`${name}\\\``), `${document}: ${name}`);
    }
  }
});

test("runner integration references document executable adapter contracts", () => {
  for (const document of ["docs/api/vitest-plugin.md", "docs/ko/api/vitest-plugin.md"]) {
    const source = read(document);

    for (const name of [
      "createLunaVitestRunner",
      "assertScenario",
      "createLunaVitestWatchTrigger",
    ]) {
      assert.match(source, new RegExp(`\\\`${name}`), `${document}: ${name}`);
    }
    assert.doesNotMatch(source, /does not register Vitest hooks or execute Lua scenarios|Lua scenario를 실행하지 않습니다/);
  }

  for (const document of ["docs/api/playwright-plugin.md", "docs/ko/api/playwright-plugin.md"]) {
    const source = read(document);

    for (const name of ["createLunaCommands", "createLunaPageAdapter", "assertScenario"]) {
      assert.match(source, new RegExp(`\\\`${name}`), `${document}: ${name}`);
    }
    assert.doesNotMatch(source, /experimental deterministic placeholder|deterministic placeholder/);
  }

  for (const document of [
    "README.md",
    "README.ko.md",
    "docs/guides/library-consumption.md",
    "docs/ko/guides/library-consumption.md",
    "docs/guides/playwright-routing.md",
    "docs/ko/guides/playwright-routing.md",
  ]) {
    const source = read(document);
    assert.match(source, /createLunaPageAdapter|createLunaVitestPlugin/, document);
    assert.doesNotMatch(source, /returns \{ id, pass: true \}|\{ id, pass: true \}.*반환/, document);
  }

  for (const document of ["docs/guides/ci-integration.md", "docs/ko/guides/ci-integration.md"]) {
    const source = read(document);
    assert.match(source, /test:browser:ci/, document);
    assert.match(source, /browser-scenario/, document);
  }
});

test("scenario authoring guides include explicit coverage metadata", () => {
  for (const document of [
    "docs/guides/writing-scenarios.md",
    "docs/ko/guides/scenario-examples.md",
  ]) {
    const source = read(document);
    assert.equal(
      luaBlocks(source).some((block) =>
        /coverage\s*=\s*\{/.test(block)
        && /features\s*=\s*\{/.test(block)
        && /states\s*=\s*\{/.test(block)
        && /components\s*=\s*\{/.test(block)),
      true,
      document,
    );
  }
});

test("published documentation source excludes historical plans and the legacy PRD", () => {
  assert.equal(existsSync(path.join(ROOT, "docs/PRD.md")), false);
  assert.equal(existsSync(path.join(ROOT, "docs/plans")), false);
  assertExists("planning/README.md");
  assertExists("planning/archive/PRD.md");
  assertExists("planning/archive/plans");
});

test("documentation navigation exposes bilingual API and guide coverage", () => {
  const config = read("docs/.vitepress/config.mts");
  const requiredLinks = [
    "/api/contracts",
    "/api/core",
    "/api/runtime-intercept",
    "/api/cli",
    "/api/mcp",
    "/api/react",
    "/api/vitest-plugin",
    "/api/playwright-plugin",
    "/ko/api/contracts",
    "/ko/api/core",
    "/ko/api/runtime-intercept",
    "/ko/api/cli",
    "/ko/api/mcp",
    "/ko/api/react",
    "/ko/api/vitest-plugin",
    "/ko/api/playwright-plugin",
    "/guides/cli-workflow",
    "/guides/e2e-0to1",
    "/guides/playwright-routing",
    "/guides/react-integration",
    "/guides/scenario-examples",
    "/guides/wagmi-swap-quickstart",
    "/ko/guides/ci-integration",
    "/ko/guides/writing-scenarios",
    "/ko/guides/multi-stage",
    "/ko/guides/wagmi-setup",
    "/ko/guides/ethers-setup",
    "/ko/guides/web3js-setup",
    "/ko/guides/wagmi-swap-quickstart",
  ];

  for (const link of requiredLinks) {
    assert.match(
      config,
      new RegExp(`\\{\\s*text:\\s*"[^"]+"\\s*,\\s*link:\\s*"${escapeRegExp(link)}"\\s*\\}`),
      link,
    );
  }
});

test("validated wagmi quickstart stays aligned with packed and registry evidence", () => {
  const documents = [
    "docs/guides/wagmi-swap-quickstart.md",
    "docs/ko/guides/wagmi-swap-quickstart.md",
  ];
  const fixtureManifest = JSON.parse(read("consumer-proof/wagmi-swap/package.json"));

  for (const document of documents) {
    const source = read(document);
    for (const version of [
      "pnpm | 10.33.4",
      "React / React DOM | 19.2.8",
      "@wagmi/core` | 3.6.4",
      "viem` | 2.55.11",
      "Vitest | 4.1.6",
      "Playwright | 1.61.1",
    ]) {
      assert.match(source, new RegExp(escapeRegExp(version)), `${document}: ${version}`);
    }
    for (const command of [
      "pnpm install --frozen-lockfile",
      "pnpm --filter @lunatest/e2e-tests exec playwright install --with-deps chromium",
      "pnpm quickstart:wagmi:validate -- --enforce-ci-budget",
      "pnpm consumer-proof:registry -- --enforce-ci-budget",
    ]) {
      assert.match(source, new RegExp(escapeRegExp(command)), `${document}: ${command}`);
    }
    for (const evidence of [
      "certificationEligible",
      "30/30",
      "120.793 ms",
      "214.317 ms",
      "65",
      "then_ui.output_balance",
      "packed-artifact",
      "create-vite@9.1.2",
      "@wagmi/core >=3.6.4 <4",
      "viem >=2.55.11 <3",
      "31935453165",
      "9260530901",
      "1b5b20cd374ff1fc3fd10051dbd6d7dd8145e7b90800683ed47ee43a7ea34764",
    ]) {
      assert.match(source, new RegExp(escapeRegExp(evidence)), `${document}: ${evidence}`);
    }

    for (const { name } of publicPackages) {
      const version =
        fixtureManifest.dependencies?.[name] ?? fixtureManifest.devDependencies?.[name];
      assert.equal(typeof version, "string", `${name}: missing fixture pin`);
      const tableRow = `| \`${name}\` | ${version} |`;
      assert.match(source, new RegExp(escapeRegExp(tableRow)), `${document}: ${tableRow}`);
    }
    assert.doesNotMatch(source, /under 10 minutes|within 10 minutes|10분 (안에|이내)/i);
  }
});
