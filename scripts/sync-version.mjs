// Single version source = package.json. This propagates that one number into the
// few other files that must carry it, so a release is a single `npm version`
// bump. Wired as the npm `version` lifecycle script, so it runs automatically on
// every `npm version <patch|minor|major>` and stages the touched files into the
// version commit. Also runnable by hand: `node scripts/sync-version.mjs`.
import { readFileSync, writeFileSync } from 'node:fs';

const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const touched = [];

// manifest.json (MCPB bundle) — keep its version equal to package.json.
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
if (manifest.version !== version) {
  manifest.version = version;
  writeFileSync('manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  touched.push('manifest.json');
}

// src/version.mjs FALLBACK — the last-resort literal for packaged builds where
// package.json isn't readable; keep it in step so it can never drift.
const vpath = 'src/version.mjs';
const before = readFileSync(vpath, 'utf8');
const after = before.replace(/const FALLBACK = '[^']*';/, `const FALLBACK = '${version}';`);
if (after !== before) { writeFileSync(vpath, after); touched.push(vpath); }

console.log(touched.length ? `sync-version: ${version} -> ${touched.join(', ')}` : `sync-version: already ${version}`);
