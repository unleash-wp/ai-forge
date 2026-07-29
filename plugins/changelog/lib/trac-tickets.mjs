// Changelog plugin: Trac *queries* (ticket details, counts, CSV parsing). The
// cookie credential + its validity check live in the Core connector
// (src/connectors/wporg-cookie.mjs); this module reuses that connector's Trac
// base/UA/bot-wall check and only issues the changelog-specific queries.
import { TRAC, UA, tracBlocked } from '../../../src/connectors/wporg-cookie.mjs';
import { timeoutSignal } from '../../../src/lib/net.mjs';

// One request pulls the whole milestone's closed tickets WITH descriptions.
// Returns Map<id, { summary, description, component, type, owner, priority }>.
export async function fetchTicketDetails({ milestone, cookie }) {
  if (!milestone) throw new Error('--deep needs --milestone');
  if (!cookie) throw new Error('no Trac cookie - set WPORG_TRAC_COOKIE or pass --trac-cookie <file>');

  const url = `${TRAC}/query?status=closed&milestone=${encodeURIComponent(milestone)}` +
    '&max=0&order=id&col=id&col=summary&col=component&col=type&col=owner&col=priority&col=description&format=csv';

  const res = await fetch(url, { headers: { Cookie: cookie, 'User-Agent': UA, Accept: 'text/csv' }, signal: timeoutSignal() });
  const body = await res.text();
  if (tracBlocked(res, body)) {
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

// Count the rows the Sources "Closed Core Trac tickets" link returns, so the
// Core-tickets card can match the exact query the user clicks to verify. Takes
// that same query URL and just asks Trac for every row as CSV. Needs the cookie
// (the CSV endpoint is behind Trac's bot wall).
export async function countTracTickets(queryUrl, cookie) {
  if (!cookie) throw new Error('no Trac cookie');
  const url = queryUrl + (queryUrl.includes('?') ? '&' : '?') + 'max=0&format=csv';
  const res = await fetch(url, { headers: { Cookie: cookie, 'User-Agent': UA, Accept: 'text/csv' }, signal: timeoutSignal() });
  const body = await res.text();
  if (tracBlocked(res, body)) {
    throw new Error(`Trac blocked the request (HTTP ${res.status}). Cookie expired, or the bot wall is up.`);
  }
  const rows = parseCsv(body);
  if (!rows.length) return 0;
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const iId = head.indexOf('id');
  if (iId === -1) throw new Error('unexpected Trac CSV (no id column)');
  let n = 0;
  for (const row of rows.slice(1)) if (Number(row[iId])) n++;
  return n;
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
