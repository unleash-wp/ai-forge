// Core connector: the WordPress.org session cookie. Owns the credential store
// (path/save/delete/resolve) and the cookie's own validity check. Trac *queries*
// (ticket details, counts) live in the changelog plugin — this module only knows
// how to hold and verify the credential, so the Core shell can drive setup
// without importing any tool. The low-level Trac base/UA/bot-wall check are
// exported so the plugin's queries reuse them instead of re-declaring them.
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { timeoutSignal } from '../lib/net.mjs';

export const TRAC = 'https://core.trac.wordpress.org';
export const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0 Safari/537.36';

// True when a Trac response is the "Checking your browser" bot wall (or an auth
// failure body) rather than real data. Shared by every Trac request.
export function tracBlocked(res, body) {
  return !res.ok || /Checking your browser|__challenge|Javascript required/.test(body.slice(0, 600));
}

// Default cookie file - shared with sirreal's wordpress-trac plugin and outside
// any repo, so it is never committed by accident.
export function cookiePath() {
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(base, 'wp-trac', 'cookie');
}

// Persist the pasted Cookie header locally (owner-only). Returns the path.
export function saveCookie(value) {
  const p = cookiePath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, value.trim() + '\n', { mode: 0o600 });
  return p;
}

// Remove the saved cookie file (the setup wizard's Disconnect). No-op if absent.
export function deleteCookie() {
  try { unlinkSync(cookiePath()); return true; } catch { return false; }
}

// Trac's CSV export (unlike its HTML query) needs a logged-in WordPress.org
// session cookie - the same WPORG_TRAC_COOKIE the mcp-context-wporg server uses -
// or it returns the "Checking your browser" bot wall. Resolution order:
// WPORG_TRAC_COOKIE env, then an explicit file, then the default cookie file.
export function resolveCookie({ cookieFile } = {}) {
  if (process.env.WPORG_TRAC_COOKIE) return process.env.WPORG_TRAC_COOKIE.trim();
  for (const f of [cookieFile, cookiePath()]) {
    if (!f) continue;
    try {
      const v = readFileSync(f, 'utf8').trim();
      if (v) return v;
    } catch {
      // missing/unreadable -> try next
    }
  }
  return null;
}

// Cheap reachability check: one closed-ticket row. false if the bot wall or an
// auth failure comes back. This is the connector's own `validate(cred)` — it
// knows the provider-specific CSV URL + bot wall.
export async function validateCookie(cookie) {
  const res = await fetch(`${TRAC}/query?status=closed&max=1&col=id&format=csv`, {
    headers: { Cookie: cookie, 'User-Agent': UA, Accept: 'text/csv' }, signal: timeoutSignal(),
  });
  const body = await res.text();
  if (tracBlocked(res, body)) return false;
  return true;
}
