import { Command, CommanderError } from "commander";

import { coverageCommand } from "./commands/coverage";
import { genCommand } from "./commands/gen";
import { runCommand } from "./commands/run";
import { watchCommand } from "./commands/watch";
import { loadConfig } from "./config";

export type CliExecutionResult = {
  exitCode: number;
  output: string;
};

export function executeCommand(args: string[]): CliExecutionResult {
  let output = "";
  let exitCode = 0;

  loadConfig();

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
    .action((filter?: string) => {
      output = runCommand(filter);
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

  try {
    program.parse(args, { from: "user" });
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
