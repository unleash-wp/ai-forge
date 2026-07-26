#!/usr/bin/env node
import { run } from '../src/cli.mjs';

// Safety net: a stray unhandled rejection (e.g. a background fetch settling after
// its route already responded) must not take the process down. Log to stderr —
// stdout is reserved for MCP JSON-RPC. Per-request errors are handled at the
// server's own top-level boundary; this only catches what escapes it.
process.on('unhandledRejection', (err) => {
  console.error(`uwp-ai-forge: unhandled rejection: ${err && err.message ? err.message : err}`);
});

run(process.argv.slice(2)).catch((err) => {
  console.error(`uwp-ai-forge: ${err.message}`);
  process.exit(1);
});
