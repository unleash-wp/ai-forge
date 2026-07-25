#!/usr/bin/env node
// Scaffold a new Forge tool by copying tools/_template into tools/<id>/ and
// patching the manifest. Zero-dependency vanilla Node, like the rest of the CLI.
//
//   node scripts/new-tool.mjs <id> [Display Name]
//   npm run new-tool -- <id> [Display Name]
//
// Then edit tools/<id>/client.jsx, run `npm run build`, and restart serve.
import { readdirSync, existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const TOOLS = join(DIR, '..', 'tools');
const TEMPLATE = join(TOOLS, '_template');

const id = (process.argv[2] || '').trim();
const name = process.argv.slice(3).join(' ').trim() || titleCase(id);

if (!id) {
  console.error('usage: node scripts/new-tool.mjs <id> [Display Name]');
  process.exit(1);
}
if (!/^[a-z][a-z0-9-]*$/.test(id)) {
  console.error(`invalid id "${id}": use lowercase letters, digits and hyphens, starting with a letter`);
  process.exit(1);
}
if (!existsSync(TEMPLATE)) {
  console.error('tools/_template is missing; cannot scaffold');
  process.exit(1);
}
const dest = join(TOOLS, id);
if (existsSync(dest)) {
  console.error(`tools/${id} already exists`);
  process.exit(1);
}

mkdirSync(dest);
for (const file of readdirSync(TEMPLATE)) copyFileSync(join(TEMPLATE, file), join(dest, file));

const manifestPath = join(dest, 'plugin.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.id = id;
manifest.name = name;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(`created tools/${id}/ (${name})`);
console.log('next: edit client.jsx, run `npm run build`, then restart serve');

function titleCase(s) { return s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()); }
