import {
  createDeterministicScenarioAdapter,
  loadLunaProjectConfig,
  loadLunaProjectScenarios,
} from "@lunatest/core";

import { createMcpServer } from "../server.js";

export const MCP_STDIO_USAGE = `Usage: lunatest-mcp [options]

Options:
  --config <path>  Load a LunaTest project from this config file
  --empty          Start an intentionally empty generic server
  --help           Print this usage information`;

export type McpStdioArgs =
  | { mode: "help" }
  | { mode: "empty" }
  | { mode: "project"; configPath?: string };

export type CreateProjectMcpServerOptions = {
  cwd?: string;
  configPath?: string;
};

export type McpStdioApp =
  | { kind: "help"; usage: string }
  | { kind: "server"; server: ReturnType<typeof createMcpServer> };

export function formatMcpStdioError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createArgumentError(message: string): Error {
  return new Error(`${message}\n\n${MCP_STDIO_USAGE}`);
}

export function parseMcpStdioArgs(argv: readonly string[]): McpStdioArgs {
  let configPath: string | undefined;
  let empty = false;
  let help = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--help") {
      help = true;
      continue;
    }

    if (argument === "--empty") {
      empty = true;
      continue;
    }

    if (argument === "--config") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw createArgumentError("Option --config requires a path");
      }
      if (configPath) {
        throw createArgumentError("Option --config may only be specified once");
      }

      configPath = value;
      index += 1;
      continue;
    }

    throw createArgumentError(`Unknown option: ${argument}`);
  }

  if (empty && configPath) {
    throw createArgumentError("Option --empty cannot be combined with --config");
  }

  if (help) {
    return { mode: "help" };
  }

  if (empty) {
    return { mode: "empty" };
  }

  return configPath ? { mode: "project", configPath } : { mode: "project" };
}

function withEmptyModeGuidance(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`${message}\nUse --empty to start an intentional generic server.`);
}

export async function createProjectMcpServer(
  options: CreateProjectMcpServerOptions = {},
): Promise<ReturnType<typeof createMcpServer>> {
  let config;
  try {
    config = await loadLunaProjectConfig({
      cwd: options.cwd,
      configPath: options.configPath,
      requireConfig: true,
    });
  } catch (error) {
    throw withEmptyModeGuidance(error);
  }

  const scenarios = await loadLunaProjectScenarios({ config });

  return createMcpServer({
    scenarios: scenarios.map(({ id, name, lua, coverage }) => ({
      id,
      name,
      lua,
      coverage,
    })),
    coverageCatalog: config.coverageCatalog,
    projectRoot: config.projectRoot,
    scenarioAdapter: createDeterministicScenarioAdapter(),
  });
}

export async function createMcpStdioApp(
  argv: readonly string[],
  options: CreateProjectMcpServerOptions = {},
): Promise<McpStdioApp> {
  const args = parseMcpStdioArgs(argv);

  if (args.mode === "help") {
    return { kind: "help", usage: MCP_STDIO_USAGE };
  }

  if (args.mode === "empty") {
    return {
      kind: "server",
      server: createMcpServer({ scenarios: [] }),
    };
  }

  return {
    kind: "server",
    server: await createProjectMcpServer({
      cwd: options.cwd,
      configPath: args.configPath,
    }),
  };
}
