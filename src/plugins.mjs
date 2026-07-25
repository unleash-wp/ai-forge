// Tool plugin registry. A plugin is a folder under tools/ with a plugin.json
// manifest and (optionally) a server.mjs that exports `routes`. The manifest is
// the contract: id, name, description, icon drive the UI; price + updateSource
// are the hooks a later premium/marketplace layer reads (nothing paid ships now
// - the free core stays free). Contributors add a folder; nothing else to wire.
import { readdirSync, existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { VERSION } from './version.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const TOOLS = join(DIR, '..', 'tools');
const CORE_VERSION = VERSION;

// Compare two "x.y.z" strings: -1 if a < b, 0 if equal, 1 if a > b.
function cmpVersion(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) { const x = pa[i] || 0, y = pb[i] || 0; if (x !== y) return x < y ? -1 : 1; }
  return 0;
}

// Does the running core satisfy a manifest's `coreVersion` (e.g. ">=0.1.0")?
// Supports >=, >, <=, <, = and a bare version (treated as >=). Unknown formats
// and a missing/"*" range never block — the check only rejects clear mismatches.
export function satisfiesCore(range, core = CORE_VERSION) {
  if (!range || range === '*') return true;
  const m = String(range).match(/^\s*(>=|<=|>|<|=)?\s*([0-9]+(?:\.[0-9]+){0,2})\s*$/);
  if (!m) return true;
  const op = m[1] || '>=', c = cmpVersion(core, m[2]);
  if (op === '>') return c > 0;
  if (op === '<=') return c <= 0;
  if (op === '<') return c < 0;
  if (op === '=') return c === 0;
  return c >= 0;
}

export async function loadPlugins() {
  const plugins = [];
  if (!existsSync(TOOLS)) return plugins;
  for (const id of readdirSync(TOOLS).sort()) {
    if (id.startsWith('_')) continue; // _template etc. are copy-me examples, not live tools
    const dir = join(TOOLS, id);
    if (!statSync(dir).isDirectory()) continue;
    const manifestPath = join(dir, 'plugin.json');
    if (!existsSync(manifestPath)) continue;
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch (err) {
      console.error(`plugin "${id}": ignored, bad plugin.json (${err.message})`);
      continue;
    }
    if (!satisfiesCore(manifest.coreVersion)) {
      console.error(`plugin "${id}": needs core ${manifest.coreVersion}, running ${CORE_VERSION} - skipped`);
      continue;
    }
    let mod = null;
    const serverPath = join(dir, 'server.mjs');
    if (existsSync(serverPath)) {
      try {
        mod = await import(pathToFileURL(serverPath).href);
      } catch (err) {
        console.error(`plugin "${id}": server.mjs failed to load (${err.message})`);
      }
    }
    plugins.push({
      manifest,
      routes: (mod && mod.routes) || [],
      commands: (mod && mod.commands) || [],
      mcpTools: (mod && mod.mcpTools) || [],
      skills: (mod && mod.skills) || [],
      uiResources: (mod && mod.uiResources) || [],
    });
  }
  return plugins;
}
