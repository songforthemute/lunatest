import { Command, CommanderError } from "commander";

import { loadConfig } from "./config.js";
import { coverageCommand } from "./commands/coverage.js";
import { devtoolsCommand } from "./commands/devtools.js";
import { doctorCommand } from "./commands/doctor.js";
import { genCommand } from "./commands/gen.js";
import { runCommand } from "./commands/run.js";
import { validateCommand } from "./commands/validate.js";
import { watchCommand } from "./commands/watch.js";

export type CliExecutionResult = {
  exitCode: number;
  output: string;
};

export type ExecuteCommandOptions = {
  cwd?: string;
  signal?: AbortSignal;
  streamOutput?: (chunk: string) => void;
};

export async function executeCommand(
  args: string[],
  options: ExecuteCommandOptions = {},
): Promise<CliExecutionResult> {
  let output = "";
  let exitCode = 0;

  const config = await loadConfig(options.cwd);
  const setExitCodeBySummary = (summary: string): void => {
    const match = summary.match(/(?:^|\n)failed=(\d+)(?:\n|$)/);
    if (!match) {
      return;
    }

    const failed = Number(match[1] ?? "0");
    if (failed > 0) {
      exitCode = 1;
    }
  };

  const program = new Command();
  program.name("lunatest");
  program.exitOverride();
  program.showHelpAfterError();
  program.configureOutput({
    writeOut(message) {
      output += message;
    },
    writeErr(message) {
      output += message;
    },
  });

  program
    .command("run")
    .argument("[filter]")
    .option("--scenario <fileOrGlob>")
    .action(async (filter?: string, options?: { scenario?: string }) => {
      output = await runCommand({
        filter,
        scenario: options?.scenario,
        config,
      });
      setExitCodeBySummary(output);
    });

  program
    .command("validate")
    .option("--scenario <fileOrGlob>")
    .action(async (options?: { scenario?: string }) => {
      output = await validateCommand({
        scenario: options?.scenario,
        config,
      });
      setExitCodeBySummary(output);
    });

  program.command("watch").argument("[filter]").action(async (filter?: string) => {
    output = await watchCommand({
      filter,
      config,
      signal: options.signal,
      onUpdate(chunk) {
        output += `${chunk}\n`;
        options.streamOutput?.(`${chunk}\n`);
      },
    });
  });

  program.command("coverage").action(async () => {
    output = await coverageCommand(config);
  });

  program
    .command("gen")
    .option("--ai", "run AI-based generation")
    .option("--scenario <fileOrGlob>")
    .action(async (options: { ai?: boolean; scenario?: string }) => {
      output = await genCommand({
        ai: Boolean(options.ai),
        scenario: options.scenario,
        config,
      });
      if (!options.ai) {
        exitCode = 1;
      }
    });

  program
    .command("devtools")
    .option("--open", "print devtools mounting guide")
    .action(async (options: { open?: boolean }) => {
      output = devtoolsCommand({
        open: Boolean(options.open),
        config,
      });
      if (!options.open) {
        exitCode = 1;
      }
    });

  program.command("doctor").action(() => {
    output = doctorCommand(config);
  });

  try {
    await program.parseAsync(args, { from: "user" });
  } catch (error) {
    if (error instanceof CommanderError) {
      exitCode = error.exitCode ?? 1;
      if (output.trim().length === 0) {
        output = error.message;
      }
    } else {
      exitCode = 1;
      output = error instanceof Error ? error.message : String(error);
    }
  }

  if (output.trim().length === 0) {
    output = program.helpInformation();
    if (args.length === 0) {
      exitCode = 1;
    }
  }

  return {
    exitCode,
    output: output.trim(),
  };
}
