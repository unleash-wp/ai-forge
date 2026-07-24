// Curated Forge marketplace registry. Today it is a JSON file committed to this
// repo - UnleashWP curates what is "verified" by editing it. Set FORGE_REGISTRY_URL
// to serve a live hosted registry instead (with the committed file as fallback),
// so the catalog can update without a release.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const LOCAL = join(DIR, '..', 'marketplace.json');

export async function getMarketplace() {
  const remote = process.env.FORGE_REGISTRY_URL;
  if (remote) {
    try {
      const r = await fetch(remote);
      if (r.ok) { const d = await r.json(); return { tools: d.tools || [], source: 'remote' }; }
    } catch { /* fall through to the committed registry */ }
  }
  const d = JSON.parse(readFileSync(LOCAL, 'utf8'));
  return { tools: d.tools || [], source: 'local' };
}
