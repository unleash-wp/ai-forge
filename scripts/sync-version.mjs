// package.json is the single source of truth for the version. manifest.json (MCPB)
// is static JSON that can't read it, so this copies the number in. Wired as the npm
// `version` lifecycle script (runs on `npm version …`) and prepended to mcpb:pack —
// so the version is never typed anywhere but package.json (via `npm version`).
import { readFileSync, writeFileSync } from 'node:fs';

const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));

if (manifest.version !== version) {
  manifest.version = version;
  writeFileSync('manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  console.log(`sync-version: manifest.json -> ${version}`);
} else {
  console.log(`sync-version: already ${version}`);
}
