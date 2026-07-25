// Single source for the app version. Prefer package.json (dev + npm installs);
// fall back to a literal for packaged builds (SEA / pkg / Tauri) where the file
// may not sit next to this module and readFileSync would throw. Keep FALLBACK in
// sync with package.json — a CI guard will enforce that once the release
// pipeline lands (one version source, all manifests derived).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const FALLBACK = '0.1.1';

function readVersion() {
  try {
    const dir = dirname(fileURLToPath(import.meta.url));
    return JSON.parse(readFileSync(join(dir, '..', 'package.json'), 'utf8')).version || FALLBACK;
  } catch {
    return FALLBACK;
  }
}

export const VERSION = readVersion();
