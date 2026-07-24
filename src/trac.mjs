import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

const TRAC = 'https://core.trac.wordpress.org';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0 Safari/537.36';

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
// auth failure comes back.
export async function validateCookie(cookie) {
  const res = await fetch(`${TRAC}/query?status=closed&max=1&col=id&format=csv`, {
    headers: { Cookie: cookie, 'User-Agent': UA, Accept: 'text/csv' },
  });
  const body = await res.text();
  if (!res.ok || /Checking your browser|__challenge|Javascript required/.test(body.slice(0, 600))) return false;
  return true;
}

// One request pulls the whole milestone's closed tickets WITH descriptions.
// Returns Map<id, { summary, description, component, type, owner, priority }>.
export async function fetchTicketDetails({ milestone, cookie }) {
  if (!milestone) throw new Error('--deep needs --milestone');
  if (!cookie) throw new Error('no Trac cookie - set WPORG_TRAC_COOKIE or pass --trac-cookie <file>');

  const url = `${TRAC}/query?status=closed&milestone=${encodeURIComponent(milestone)}` +
    '&max=0&order=id&col=id&col=summary&col=component&col=type&col=owner&col=priority&col=description&format=csv';

  const res = await fetch(url, { headers: { Cookie: cookie, 'User-Agent': UA, Accept: 'text/csv' } });
  const body = await res.text();
  if (!res.ok || /Checking your browser|__challenge|Javascript required/.test(body.slice(0, 600))) {
    throw new Error(`Trac blocked the request (HTTP ${res.status}). Cookie expired, or the bot wall is up.`);
  }

  const rows = parseCsv(body);
  if (!rows.length) return new Map();
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name) => head.indexOf(name);
  const iId = idx('id');
  if (iId === -1) throw new Error('unexpected Trac CSV (no id column)');

  const map = new Map();
  for (const row of rows.slice(1)) {
    const id = Number(row[iId]);
    if (!id) continue;
    map.set(id, {
      summary: pick(row, idx('summary')),
      description: pick(row, idx('description')),
      component: pick(row, idx('component')),
      type: pick(row, idx('type')),
      owner: pick(row, idx('owner')),
      priority: pick(row, idx('priority')),
    });
  }
  return map;
}

const pick = (row, i) => (i >= 0 ? (row[i] ?? '').trim() : '');

// RFC 4180 CSV: handles quoted fields with embedded commas, quotes and newlines
// (Trac descriptions are multi-line, so this must not split on raw newlines).
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\r') {
      // ignore; \n handles the row break
    } else if (ch === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}
