import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXAMPLE_DIR = path.join(ROOT, "examples", "swap-dapp");
const DOCS_DIST = path.join(ROOT, "docs", ".vitepress", "dist");
const EXAMPLE_OUT_DIR = path.join(DOCS_DIST, "examples", "swap-dapp");
const EXAMPLE_INDEX_LABEL = "examples/swap-dapp/index.html";
const EXAMPLE_INDEX = path.join(EXAMPLE_OUT_DIR, "index.html");
const EXAMPLE_LUA_LABEL = "examples/swap-dapp/lunatest.lua";
const EXAMPLE_LUA_SOURCE = path.join(EXAMPLE_DIR, "lunatest.lua");
const EXAMPLE_LUA_OUT = path.join(EXAMPLE_OUT_DIR, "lunatest.lua");
const PNPM = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function normalizeDocsBase(value) {
  if (!value || value === "/") {
    return "/";
  }

  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? ROOT,
    env: options.env ?? process.env,
    encoding: "utf8",
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const docsBase = normalizeDocsBase(process.env.DOCS_BASE ?? "/");
const exampleBase = `${docsBase}examples/swap-dapp/`;
const exampleOutDir = path.relative(EXAMPLE_DIR, EXAMPLE_OUT_DIR);

run(PNPM, ["run", "build:workspace:ci"]);
run(PNPM, ["exec", "vitepress", "build", "docs"]);
run(PNPM, ["exec", "tsc", "-p", "tsconfig.json", "--noEmit"], {
  cwd: EXAMPLE_DIR,
});
run(PNPM, ["exec", "vite", "build", "--base", exampleBase, "--outDir", exampleOutDir, "--emptyOutDir", "false"], {
  cwd: EXAMPLE_DIR,
  env: {
    ...process.env,
    VITE_LUNATEST_DEMO_MODE: "deterministic",
  },
});
copyFileSync(EXAMPLE_LUA_SOURCE, EXAMPLE_LUA_OUT);

if (!existsSync(EXAMPLE_INDEX)) {
  console.error(`[docs build] Missing live demo artifact: ${EXAMPLE_INDEX_LABEL}`);
  process.exit(1);
}

if (!existsSync(EXAMPLE_LUA_OUT)) {
  console.error(`[docs build] Missing live demo artifact: ${EXAMPLE_LUA_LABEL}`);
  process.exit(1);
}
