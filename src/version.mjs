// The version is read from package.json, the single source of truth. There is no
// hardcoded version literal in the code: package.json ships in every distribution
// (the npm tarball and the .mcpb bundle both include it), so this always resolves.
// The '0.0.0' is only a never-maintained sentinel for the theoretical case where
// the file can't be read (e.g. a future single-executable build).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

function readVersion() {
  try {
    const dir = dirname(fileURLToPath(import.meta.url));
    return JSON.parse(readFileSync(join(dir, '..', 'package.json'), 'utf8')).version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export const VERSION = readVersion();
