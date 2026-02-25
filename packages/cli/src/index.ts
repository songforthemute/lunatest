#!/usr/bin/env node
import { executeCommand } from "./cli";

const result = executeCommand(process.argv.slice(2));

if (result.output) {
  console.log(result.output);
}

if (result.exitCode !== 0) {
  process.exit(result.exitCode);
}
