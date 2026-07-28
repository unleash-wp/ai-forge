// WordPress Core Trac ticket activity (Core-shared, plugin-facing).
//
// The "General Trac overview" numbers in a "Month in Core" post: how many tickets
// were opened and closed in the window. Trac's CSV export is behind a browser
// bot wall, so this needs the same WordPress.org session cookie the changelog's
// deep mode uses (src/connectors/wporg-cookie.mjs). With no cookie it returns
// null and the caller shows a "connect WordPress.org" hint - it never fabricates.
//
//   - opened: tickets whose creation date falls in the window (accurate).
//   - closed: tickets currently closed whose last change is in the window. This
//     is Trac's changetime, a close proxy - a ticket edited long after being
//     closed drifts out of the count - so it is reported as an approximation.
import { TRAC, UA, tracBlocked, resolveCookie } from '../connectors/wporg-cookie.mjs';
import { OFFLINE } from './cache-store.mjs';

// A strict YYYY-MM-DD day, so an unvalidated ?since/&until can't inject extra
// parameters into the Trac query URL (e.g. "1&status=x").
const day = (d) => {
  const s = String(d).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`invalid date: ${s}`);
  return s;
};

// Count the rows a Trac query returns. Requesting only col=id keeps every row on
// its own line (no multi-line description fields), so a line count is exact.
async function countQuery(filter, cookie) {
  const url = `${TRAC}/query?${filter}&max=0&col=id&format=csv`;
  const res = await fetch(url, { headers: { Cookie: cookie, 'User-Agent': UA, Accept: 'text/csv' } });
  const body = await res.text();
  if (tracBlocked(res, body)) throw new Error(`Trac blocked the request (HTTP ${res.status}). Cookie expired, or the bot wall is up.`);
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
  return Math.max(0, lines.length - 1); // drop the "id" header row
}

// { opened, closed, closedApprox: true } for the window, or null with no cookie /
// in offline mode (a read-only host must not hit Trac on wordpress.org either).
export async function ticketActivity({ since, until, cookie = resolveCookie() } = {}) {
  if (OFFLINE || !cookie) return null;
  // Trac's creation-date field is `time` (it silently ignores `created`, which
  // would return every ticket). `changetime` is last-modified: a close proxy.
  const [opened, closed] = await Promise.all([
    countQuery(`time=${day(since)}..${day(until)}`, cookie),
    countQuery(`status=closed&changetime=${day(since)}..${day(until)}`, cookie),
  ]);
  return { opened, closed, closedApprox: true };
}
