import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBackupPath,
  resolveRepoRootFromScriptUrl,
} from "./check-workspace-type-resolution.mjs";

test("resolveRepoRootFromScriptUrl decodes file URLs", () => {
  assert.equal(
    resolveRepoRootFromScriptUrl("file:///tmp/my%20repo/scripts/check-workspace-type-resolution.mjs"),
    "/tmp/my repo",
  );
});

test("buildBackupPath preserves repo-relative backup layout", () => {
  assert.equal(
    buildBackupPath(
      "/tmp/my repo/packages/core/dist",
      "/tmp/my repo",
      "/tmp/my repo/node_modules/.cache/lunatest-workspace-types-123",
    ),
    "/tmp/my repo/node_modules/.cache/lunatest-workspace-types-123/packages/core/dist",
  );
});
