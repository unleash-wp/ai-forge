// Tool plugin registry. A plugin is a folder under tools/ with a plugin.json
// manifest and (optionally) a server.mjs that exports `routes`. The manifest is
// the contract: id, name, description, icon drive the UI; price + updateSource
// are the hooks a later premium/marketplace layer reads (nothing paid ships now
// - the free core stays free). Contributors add a folder; nothing else to wire.
import { readdirSync, existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const TOOLS = join(DIR, '..', 'tools');

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
    let mod = null;
    const serverPath = join(dir, 'server.mjs');
    if (existsSync(serverPath)) {
      try {
        mod = await import(pathToFileURL(serverPath).href);
      } catch (err) {
        console.error(`plugin "${id}": server.mjs failed to load (${err.message})`);
      }
    }
    plugins.push({ manifest, routes: (mod && mod.routes) || [] });
  }
  return plugins;
}
