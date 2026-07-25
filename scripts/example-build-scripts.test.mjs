import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const buildCommandModule = await import("./build-command.mjs").catch(() => null);
const exampleBuildScripts = [
  "../examples/defi-dashboard/scripts/build.mjs",
  "../examples/swap-dapp/scripts/build.mjs",
];

test("build command resolves Windows pnpm through cmd.exe and returns spawn diagnostics", () => {
  assert.ok(buildCommandModule, "build-command runner must exist");

  let actualInvocation;
  const result = buildCommandModule.runBuildCommand("pnpm", ["exec", "vite", "build"], {
    comSpec: "C:\\Windows\\System32\\cmd.exe",
    cwd: "C:\\workspace",
    platform: "win32",
    spawnSync(command, args, options) {
      actualInvocation = { command, args, options };
      return { error: new Error("spawn EPERM"), status: null, stderr: "", stdout: "" };
    },
  });

  assert.deepEqual(actualInvocation, {
    command: "C:\\Windows\\System32\\cmd.exe",
    args: ["/d", "/c", "pnpm.cmd", "exec", "vite", "build"],
    options: {
      cwd: "C:\\workspace",
      encoding: "utf8",
      env: process.env,
      shell: false,
      stdio: "pipe",
    },
  });
  assert.equal(result.exitCode, 1);
  assert.match(result.failureMessage, /Command failed: C:\\Windows\\System32\\cmd\.exe \/d \/c pnpm\.cmd exec vite build/);
  assert.match(result.failureMessage, /spawn EPERM/);
});

test("Vite example build wrappers use the testable runner and preserve spawn diagnostics", async () => {
  for (const path of exampleBuildScripts) {
    const script = await readFile(new URL(path, import.meta.url), "utf8");

    assert.match(script, /runBuildCommand\(\s*"pnpm"/);
    assert.match(script, /process\.exitCode/);
    assert.doesNotMatch(script, /spawnSync\(\s*"pnpm"/);
  }
});

test("documentation build resolves pnpm safely and short-circuits on failures", async () => {
  const script = await readFile(new URL("./build-docs-site.mjs", import.meta.url), "utf8");

  assert.match(script, /runBuildCommand\(command, args/);
  assert.match(script, /&&/);
  assert.match(script, /process\.exitCode/);
  assert.doesNotMatch(script, /spawnSync/);
});
