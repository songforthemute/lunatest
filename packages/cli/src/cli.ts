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

export async function executeCommand(args: string[]): Promise<CliExecutionResult> {
  let output = "";
  let exitCode = 0;

  const config = loadConfig();
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
        luaConfigPath: config.luaConfigPath,
      });
      setExitCodeBySummary(output);
    });

  program
    .command("validate")
    .option("--scenario <fileOrGlob>")
    .action(async (options?: { scenario?: string }) => {
      output = await validateCommand({
        scenario: options?.scenario,
        luaConfigPath: config.luaConfigPath,
      });
      setExitCodeBySummary(output);
    });

  program.command("watch").action(() => {
    output = watchCommand();
  });

  program.command("coverage").action(() => {
    output = coverageCommand();
  });

  program
    .command("gen")
    .option("--ai", "run AI-based generation")
    .action((options: { ai?: boolean }) => {
      output = genCommand({ ai: Boolean(options.ai) });
      if (!options.ai) {
        exitCode = 1;
      }
    });

  program
    .command("devtools")
    .option("--open", "print devtools mounting guide")
    .action((options: { open?: boolean }) => {
      output = devtoolsCommand({
        open: Boolean(options.open),
      });
      if (!options.open) {
        exitCode = 1;
      }
    });

  program.command("doctor").action(() => {
    output = doctorCommand();
  });

  try {
    await program.parseAsync(args, { from: "user" });
  } catch (error) {
    if (error instanceof CommanderError) {
      exitCode = error.exitCode || 1;
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
