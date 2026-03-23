import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

import { createPresetRegistry, listProtocolPresets, loadProjectPresetSources } from "@lunatest/core";
import type { CoverageMetadata } from "@lunatest/contracts";
import { createPromptCatalog } from "@lunatest/mcp";

import type { ResolvedLunaCliConfig } from "../config.js";
import { buildScenarioCoverageSnapshot, loadScenarioCatalog } from "../scenario-catalog.js";
import { runCommand } from "./run.js";
import { validateCommand } from "./validate.js";

export type GenCommandOptions = {
  ai: boolean;
  config: ResolvedLunaCliConfig;
  scenario?: string;
};

type GeneratedScenario = {
  name: string;
  lua: string;
  coverage?: CoverageMetadata;
  tags?: string[];
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function validateGeneratedScenarios(value: unknown): GeneratedScenario[] {
  if (!Array.isArray(value)) {
    throw new Error("AI adapter stdout must be a JSON array");
  }

  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`Generated scenario at index ${index} must be an object`);
    }

    const row = item as Record<string, unknown>;
    if (typeof row.name !== "string" || row.name.length === 0) {
      throw new Error(`Generated scenario at index ${index} requires name`);
    }
    if (typeof row.lua !== "string" || row.lua.length === 0) {
      throw new Error(`Generated scenario at index ${index} requires lua`);
    }

    return {
      name: row.name,
      lua: row.lua,
      coverage:
        row.coverage && typeof row.coverage === "object" && !Array.isArray(row.coverage)
          ? (row.coverage as CoverageMetadata)
          : undefined,
      tags: Array.isArray(row.tags)
        ? row.tags.filter((tag): tag is string => typeof tag === "string")
        : undefined,
    };
  });
}

async function runAiAdapter(
  config: ResolvedLunaCliConfig,
  input: Record<string, unknown>,
): Promise<GeneratedScenario[]> {
  if (!config.ai?.command) {
    throw new Error("gen --ai requires ai.command in lunatest.config.json");
  }

  const child = spawn(config.ai.command, config.ai.args ?? [], {
    cwd: config.cwd,
    env: {
      ...process.env,
      ...(config.ai.env ?? {}),
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];

  child.stdout.on("data", (chunk) => stdoutChunks.push(Buffer.from(chunk)));
  child.stderr.on("data", (chunk) => stderrChunks.push(Buffer.from(chunk)));
  child.stdin.write(JSON.stringify(input, null, 2));
  child.stdin.end();

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    throw new Error(
      `AI adapter failed (${exitCode}): ${Buffer.concat(stderrChunks).toString("utf8").trim()}`,
    );
  }

  const stdout = Buffer.concat(stdoutChunks).toString("utf8").trim();
  if (!stdout) {
    throw new Error("AI adapter returned empty stdout");
  }

  return validateGeneratedScenarios(JSON.parse(stdout));
}

export async function genCommand(options: GenCommandOptions): Promise<string> {
  if (!options.ai) {
    return "gen command requires --ai";
  }

  const scenarios = await loadScenarioCatalog({
    config: options.config,
    scenario: options.scenario,
    allowEmpty: true,
  });
  const coverage = buildScenarioCoverageSnapshot({
    items: scenarios,
    coverageCatalog: options.config.coverageCatalog,
  });
  const registry = createPresetRegistry({
    projectSources: await loadProjectPresetSources(options.config.cwd),
  });
  const presetCatalog = await listProtocolPresets(registry);
  const prompts = createPromptCatalog();

  const generated = await runAiAdapter(options.config, {
    scenarios: scenarios.map((scenario) => ({
      id: scenario.id,
      name: scenario.name,
      coverage: scenario.coverage,
      source: scenario.source,
    })),
    coverage,
    presetCatalog: presetCatalog.map((preset) => ({
      id: preset.qualifiedId,
      label: preset.label,
      source: preset.source,
      kind: preset.kind,
      supportedChains: preset.supportedChains,
    })),
    prompts: prompts.map((prompt) => ({
      id: prompt.id,
      text: prompt.render(
        prompt.id === "improve-coverage"
          ? [
              ...coverage.missing.features.map((item) => `feature:${item}`),
              ...coverage.missing.states.map((item) => `state:${item}`),
              ...coverage.missing.components.map((item) => `component:${item}`),
            ]
          : JSON.stringify({
              coverage,
              scenarios: scenarios.map((scenario) => ({
                id: scenario.id,
                name: scenario.name,
                coverage: scenario.coverage,
              })),
            }),
      ),
    })),
  });

  await mkdir(options.config.resolvedScenarioDir, { recursive: true });

  const writtenFiles: string[] = [];
  for (const scenario of generated) {
    const basename = `${slugify(scenario.name) || "generated-scenario"}.lua`;
    const target = path.join(options.config.resolvedScenarioDir, basename);

    if (writtenFiles.includes(target)) {
      throw new Error(`Generated scenario filename collision: ${target}`);
    }

    writtenFiles.push(target);
    await writeFile(target, scenario.lua, "utf8");
  }

  const validateResults = await Promise.all(
    writtenFiles.map((file) =>
      validateCommand({
        scenario: file,
        config: options.config,
      }),
    ),
  );

  if (validateResults.some((result) => result.includes("FAIL"))) {
    throw new Error("Generated scenarios failed validation");
  }

  const runResults = await Promise.all(
    writtenFiles.map((file) =>
      runCommand({
        scenario: file,
        config: options.config,
      }),
    ),
  );

  const passed = runResults.filter((result) => result.includes("failed=0")).length;

  return [
    "AI generation complete",
    `created=${writtenFiles.length}`,
    `validated=${writtenFiles.length}`,
    `executed=${writtenFiles.length}`,
    `passed=${passed}`,
    ...writtenFiles.map((file) => `file=${file}`),
  ].join("\n");
}
