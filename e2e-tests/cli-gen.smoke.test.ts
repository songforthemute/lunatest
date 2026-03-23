import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { genCommand } from "../packages/cli/src/commands/gen";
import { loadConfig } from "../packages/cli/src/config";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("e2e smoke: cli gen", () => {
  it("runs ai generation command output contract", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lunatest-cli-gen-smoke-"));
    tempDirs.push(dir);
    await mkdir(join(dir, "scenarios"), { recursive: true });
    await writeFile(
      join(dir, "scenarios", "swap.lua"),
      `scenario { name = "swap-smoke", given = { wallet = { connected = true } }, when = { action = "swap" }, then_ui = { quotePanel = { visible = true } } }`,
      "utf8",
    );
    await writeFile(
      join(dir, "adapter.mjs"),
      `const chunks=[]; for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk)); JSON.parse(Buffer.concat(chunks).toString("utf8")); process.stdout.write(JSON.stringify([{ name: "generated-edge-case", lua: "scenario { name = 'generated-edge-case', given = { wallet = { connected = true } }, when = { action = 'swap' }, then_ui = { quotePanel = { visible = true } } }" }]));`,
      "utf8",
    );
    await writeFile(
      join(dir, "lunatest.config.json"),
      JSON.stringify({
        scenarioDir: "scenarios",
        luaConfigPath: "lunatest.lua",
        ai: {
          command: "node",
          args: ["./adapter.mjs"],
        },
      }),
      "utf8",
    );

    const output = await genCommand({ ai: true, config: await loadConfig(dir) });
    expect(output).toContain("AI generation complete");
    expect(output).toContain("created=");
    expect(output).toContain("executed=");
  });
});
