#!/usr/bin/env node
import { run } from '../src/cli.mjs';

run(process.argv.slice(2)).catch((err) => {
  console.error(`wp-release-helper: ${err.message}`);
  process.exit(1);
});
