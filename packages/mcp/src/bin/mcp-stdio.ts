#!/usr/bin/env node

import { createMcpServer } from "../server.js";
import { runStdioServer } from "../transport/stdio.js";

const server = createMcpServer({
  scenarios: [],
});

runStdioServer({
  input: process.stdin,
  output: process.stdout,
  error: process.stderr,
  server,
}).catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
