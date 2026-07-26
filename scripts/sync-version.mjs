// package.json is the single source of truth for the version. Other manifests are
// static JSON that can't read it, so this copies the number in: manifest.json (MCPB)
// and every bundled tool plugin.json (they ship with the app, so their version
// tracks it — otherwise the update-check flags a bundled plugin against the app
// release). Wired as the npm `version` lifecycle script (runs on `npm version …`)
// and prepended to mcpb:pack — so the version is never typed anywhere but package.json.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const written = [];

function sync(path) {
  const obj = JSON.parse(readFileSync(path, 'utf8'));
  if (obj.version === version) return;
  obj.version = version;
  writeFileSync(path, JSON.stringify(obj, null, 2) + '\n');
  written.push(path);
  console.log(`sync-version: ${path} -> ${version}`);
}

sync('manifest.json');

for (const id of existsSync('tools') ? readdirSync('tools') : []) {
  if (id.startsWith('_')) continue; // `_`-prefixed = template/disabled, not a shipped plugin
  const p = join('tools', id, 'plugin.json');
  if (existsSync(p)) sync(p);
}

// Stage every file we changed so the `npm version` commit + tag include them all.
// Previously the `version` script staged only manifest.json, so tools/*/plugin.json
// drifted out of the release and lit a false "update available" for npm users.
// No-op outside a git repo (e.g. mcpb:pack in CI) or when nothing changed.
if (written.length) {
  try { execFileSync('git', ['add', ...written], { stdio: 'ignore' }); } catch { /* not a git checkout */ }
}
