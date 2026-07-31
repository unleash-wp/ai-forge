// Plugin registry. A plugin is a folder under plugins/ with a plugin.json
// manifest and (optionally) a server.mjs that exports `routes`. The manifest is
// the contract: id, name, description, icon drive the UI; price + updateSource
// are the hooks a later premium/marketplace layer reads (nothing paid ships now
// - the free core stays free). Contributors add a folder; nothing else to wire.
import { readdirSync, existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { VERSION } from './version.mjs';
import { readDisabled } from './disabled-tools.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const PLUGINS = join(DIR, '..', 'plugins'); // bundled plugins, shipped inside the package
const CORE_VERSION = VERSION;

// Community plugins live OUTSIDE the package, in the user's config dir, so a
// package update that replaces the install directory (npm i -g / npx) never
// deletes them. loadPlugins() scans this alongside the bundled plugins.
export function userPluginsDir() {
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(base, 'uwp-ai-forge', 'plugins');
}

// Is `id` a bundled plugin (ships with the package)? Bundled plugins can't be
// uninstalled — they come back on the next update.
export function isBundledPlugin(id) {
  return existsSync(join(PLUGINS, String(id), 'plugin.json'));
}

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

// Scan one plugins/ root into `byId` (keyed by manifest id). Called for the
// bundled dir first, then the user dir — so a user plugin with the same id
// overrides the bundled one (a community fork), and community ids are added.
async function scanDir(root, byId, disabled = new Set()) {
  let ids;
  // A user plugins dir can be a dangling symlink, a file, or unreadable — one bad
  // dir must never reject loadPlugins() (that would 500 every route, including the
  // bundled tool). Treat an unlistable root as empty.
  try { ids = readdirSync(root).sort(); } catch { return; }
  for (const id of ids) {
    if (id.startsWith('_')) continue; // _template etc. are copy-me examples, not live tools
    try {
      const dir = join(root, id);
      if (!statSync(dir).isDirectory()) continue; // statSync follows symlinks — a dangling one throws, caught here
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
      // A deactivated tool is not loaded at all. Importing its server.mjs runs
      // the module body, and the export would go on to register MCP tools with
      // the AI host — both of which used to happen for tools the user had
      // switched off, because only the HTTP layer read that flag. The manifest
      // is still recorded so the plugin stays listed and can be switched back on.
      let mod = null;
      const serverPath = join(dir, 'server.mjs');
      if (existsSync(serverPath) && !disabled.has(manifest.id || id)) {
        try {
          // ?v=mtime busts Node's URL-keyed ESM cache, so a reinstalled/updated
          // plugin's new server.mjs loads without a process restart.
          const v = statSync(serverPath).mtimeMs;
          mod = await import(pathToFileURL(serverPath).href + '?v=' + v);
        } catch (err) {
          console.error(`plugin "${id}": server.mjs failed to load (${err.message})`);
        }
      }
      byId.set(manifest.id || id, {
        manifest,
        routes: (mod && mod.routes) || [],
        commands: (mod && mod.commands) || [],
        mcpTools: (mod && mod.mcpTools) || [],
        skills: (mod && mod.skills) || [],
        uiResources: (mod && mod.uiResources) || [],
      });
    } catch (err) {
      console.error(`plugin "${id}": ignored (${err.message})`); // unreadable entry, dangling symlink, etc.
    }
  }
}

// The three overrides exist so the deactivation rule can be tested against real
// directories instead of asserted in prose. Production passes none of them.
export async function loadPlugins({
  bundledDir = PLUGINS,
  userDir = userPluginsDir(),
  // Read once per load, not per plugin, so one scan cannot see two states.
  disabled = readDisabled(),
} = {}) {
  const byId = new Map();
  await scanDir(bundledDir, byId, disabled); // bundled (shipped with the package)
  await scanDir(userDir, byId, disabled);    // community installs (survive updates)
  return [...byId.values()];
}
