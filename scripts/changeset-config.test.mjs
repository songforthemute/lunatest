import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

async function readChangesetConfig() {
  const source = await readFile(new URL("../.changeset/config.json", import.meta.url), "utf8");
  return JSON.parse(source);
}

test("custom changelog resolves from the .changeset directory", async () => {
  const config = await readChangesetConfig();
  const [modulePath] = config.changelog;

  assert.equal(modulePath, "./changelog.cjs");

  const changesetDir = new URL("../.changeset/", import.meta.url);
  const resolvedPath = require.resolve(modulePath, {
    paths: [fileURLToPath(changesetDir)],
  });
  const changelog = require(resolvedPath);

  assert.equal(typeof changelog.getReleaseLine, "function");
  assert.equal(typeof changelog.getDependencyReleaseLine, "function");
});

test("custom changelog template path resolves from the repository root", async () => {
  const config = await readChangesetConfig();
  const [, options] = config.changelog;

  assert.equal(options.releaseNoteTemplate, "./.changeset/release-note-template.txt");
  await readFile(new URL("../.changeset/release-note-template.txt", import.meta.url), "utf8");
});
