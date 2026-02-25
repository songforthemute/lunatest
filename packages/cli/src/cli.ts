import { coverageCommand } from "./commands/coverage";
import { runCommand } from "./commands/run";
import { watchCommand } from "./commands/watch";
import { loadConfig } from "./config";

export type CliExecutionResult = {
  exitCode: number;
  output: string;
};

function helpOutput(): string {
  return "Usage: lunatest <run|watch|coverage>";
}

export function executeCommand(args: string[]): CliExecutionResult {
  const [command] = args;

  loadConfig();

  if (command === "run") {
    return {
      exitCode: 0,
      output: runCommand(),
    };
  }

  if (command === "watch") {
    return {
      exitCode: 0,
      output: watchCommand(),
    };
  }

  if (command === "coverage") {
    return {
      exitCode: 0,
      output: coverageCommand(),
    };
  }

  return {
    exitCode: 1,
    output: helpOutput(),
  };
}
