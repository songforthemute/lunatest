#!/usr/bin/env node
import { executeCommand } from "./cli.js";

const result = await executeCommand(process.argv.slice(2), {
  streamOutput(chunk) {
    process.stdout.write(chunk);
  },
});

if (result.output && process.argv[2] !== "watch") {
  console.log(result.output);
}

if (result.exitCode !== 0) {
  process.exit(result.exitCode);
}
