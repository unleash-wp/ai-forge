#!/usr/bin/env node
import { run } from '../src/cli.mjs';

run(process.argv.slice(2)).catch((err) => {
  console.error(`uwp-ai-forge: ${err.message}`);
  process.exit(1);
});
