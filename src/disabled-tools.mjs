// Which tools the user has switched off.
//
// Lifted out of server.mjs because the loader has to honour it too. It used to
// live only in the HTTP layer, so "Inactive" meant "serves no routes" and
// nothing more: the plugin's server.mjs was still imported and its module body
// still ran, its MCP tools were still registered with the AI host, and its
// client.jsx was still bundled and executed in the browser. Deactivating is the
// only containment the product offers, so it has to be read wherever a plugin
// gets loaded, not only where it gets served.
//
// The file stays where it has always been, next to the wordpress.org cookie.
// Moving it would silently reset every user's choices on upgrade.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { cookiePath } from './connectors/wporg-cookie.mjs';

export function disabledPath() {
  return join(dirname(cookiePath()), 'disabled-tools.json');
}

/** Ids the user switched off. Unreadable or missing file means nothing is off. */
export function readDisabled() {
  try {
    return new Set(JSON.parse(readFileSync(disabledPath(), 'utf8')).disabled || []);
  } catch {
    return new Set();
  }
}

export function writeDisabled(set) {
  const p = disabledPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify({ disabled: [...set] }), { mode: 0o600 });
}

export function clearDisabled(id) {
  const s = readDisabled();
  if (s.delete(id)) writeDisabled(s);
}
