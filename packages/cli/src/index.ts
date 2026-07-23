#!/usr/bin/env node
import { executeCommand } from "./cli.js";

const abortController = new AbortController();
const abortOnSigint = () => abortController.abort();
const isWatchCommand = process.argv[2] === "watch";

if (isWatchCommand) {
  process.once("SIGINT", abortOnSigint);
}

let result;
try {
  result = await executeCommand(process.argv.slice(2), {
    signal: abortController.signal,
    streamOutput(chunk) {
      process.stdout.write(chunk);
    },
  });
} finally {
  if (isWatchCommand) {
    process.removeListener("SIGINT", abortOnSigint);
  }
}

if (result.output && !isWatchCommand) {
  console.log(result.output);
}

if (result.exitCode !== 0) {
  process.exit(result.exitCode);
}
