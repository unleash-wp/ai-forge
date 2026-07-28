// Shared cache location + mode for the wp.org / GitHub caches (Core-internal).
//
// UWP_CACHE_DIR points the caches at a persistent/shared volume for a hosted deploy;
// UWP_OFFLINE makes readers serve the cache only and never fetch profiles.wordpress.org
// or Trac (so a user-facing server can't get rate-limited/blocked). GitHub stays
// reachable in offline mode by design (authenticated, no block risk).
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

export const CACHE_DIR = process.env.UWP_CACHE_DIR || join(homedir(), '.config', 'uwp-ai-forge');
export const OFFLINE = /^(1|true)$/i.test(process.env.UWP_OFFLINE || '');

export function loadJson(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return {}; }
}

// Atomic write (temp + rename) so a concurrent reader never sees a half-written
// file - important when a background ingest job writes while the app reads.
export function saveJson(file, obj) {
  try {
    mkdirSync(dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(obj));
    renameSync(tmp, file);
  } catch { /* best effort */ }
}
