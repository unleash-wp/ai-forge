// WordPress contributors (Core-shared, plugin-facing API).
//
// One call to get who contributed to Core (WordPress/wordpress-develop) and
// Gutenberg (WordPress/gutenberg) in a date window, with a per-contributor
// credited-contribution tally. Built on the same commit fetch + parse + plumbing
// filter the changelog uses, so contributor counts match across plugins.
//
// Usage (any plugin):
//   import { fetchContributors } from '../../../src/lib/wp-contributors.mjs';
//   const c = await fetchContributors({ since: '2025-10-01', until: '2025-10-31' });
//   c.totals.contributors;   // unique people
//   c.byContributor;         // [{ name, props, source }] ranked, most credited first
//
// Credit model (identical to the changelog report): Core credit is the "Props"
// line (SVN commits are all authored by the committer, so the real credit lives
// in Props — these are wp.org usernames); Gutenberg credit is the commit author
// login (a GitHub handle). `props` is the count of credited contributions:
// Core props received + Gutenberg commits authored.
import { commits, normDate, GB_REPO, CORE_REPO } from './wp-commits.mjs';
import { parseCommit, isPlumbing } from './wp-parse.mjs';
import { fetchComponentMap, componentBreakdown } from './wp-components.mjs';

const cmp = (a, b) => a.toLowerCase().localeCompare(b.toLowerCase());

const shiftMonths = (iso, months) => { const d = new Date(iso); d.setUTCMonth(d.getUTCMonth() - months); return d.toISOString().slice(0, 10); };
const dayBefore = (iso) => { const d = new Date(iso); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };

export async function fetchContributors({ since, until, coreBranch = 'trunk', gbBranch = 'trunk', components = false, firstTimersMonths = 0 } = {}) {
  const s = normDate(since, false);
  const u = normDate(until, true);
  if (!s || !u) throw new Error('since and until are required');

  const [gbRaw, coreRaw] = await Promise.all([
    commits(GB_REPO, gbBranch, s, u),
    commits(CORE_REPO, coreBranch, s, u),
  ]);
  // Same filtering as the changelog pipeline: drop release plumbing; Core commits
  // without a changeset are SVN-mirror artifacts, not changes.
  const gb = gbRaw.map(parseCommit).filter((c) => !isPlumbing(c));
  const core = coreRaw.map(parseCommit).filter((c) => c.changeset && !isPlumbing(c));

  // Tally credited contributions per person, tracking whether their credit comes
  // from Core, Gutenberg, or both, and collecting what they actually shipped
  // (up to ITEM_CAP entries each) so the UI can show "what this person built".
  const ITEM_CAP = 100;
  // Key case-insensitively so the same person credited as a GitHub login
  // ("Mamaduka") and a wp.org username ("mamaduka") is one entry, not two. The
  // wp.org (Core Props) casing wins for display, since that's the profile handle.
  const tally = new Map();
  const bump = (name, source, item) => {
    const key = name.toLowerCase();
    let cur = tally.get(key);
    if (!cur) { cur = { name, props: 0, core: 0, gutenberg: 0, source, items: [] }; tally.set(key, cur); }
    cur.props += 1;
    cur[source] += 1;
    if (source === 'core') cur.name = name;
    if (cur.source !== source) cur.source = 'both';
    if (cur.items.length < ITEM_CAP) cur.items.push(item);
  };
  for (const c of core) {
    const item = { repo: 'core', subject: c.subject, url: c.url, ref: c.changeset ? `r${c.changeset}` : c.shortSha, date: (c.date || '').slice(0, 10) };
    for (const p of c.props) bump(p, 'core', item);
  }
  for (const c of gb) {
    if (!c.author || c.author === 'unknown') continue;
    bump(c.author, 'gutenberg', { repo: 'gutenberg', subject: c.subject, url: c.url, ref: c.pr ? `#${c.pr}` : c.shortSha, date: (c.date || '').slice(0, 10) });
  }

  const byContributor = [...tally.values()]
    .sort((a, b) => b.props - a.props || cmp(a.name, b.name));

  // Daily activity histogram over the window, analytics-style (day granularity).
  const byDay = new Map();
  const tick = (c, source, names) => {
    const d = (c.date || '').slice(0, 10);
    if (!d) return;
    const e = byDay.get(d) || { date: d, contributions: 0, core: 0, gutenberg: 0, _set: new Set() };
    e.contributions += 1;
    e[source] += 1;
    for (const n of names) if (n && n !== 'unknown') e._set.add(n.toLowerCase());
    byDay.set(d, e);
  };
  for (const c of core) tick(c, 'core', c.props);
  for (const c of gb) tick(c, 'gutenberg', [c.author]);
  const timeline = [...byDay.values()]
    .map((e) => ({ date: e.date, contributions: e.contributions, core: e.core, gutenberg: e.gutenberg, contributors: e._set.size }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const coreContribs = [...new Set(core.flatMap((c) => c.props))].sort(cmp);
  const gbContribs = [...new Set(gb.map((c) => c.author).filter((a) => a && a !== 'unknown'))].sort(cmp);

  // Core committers: on wordpress-develop the commit author IS the person who
  // landed the changeset (the SVN committer), distinct from the Props credit. The
  // GitHub login is their wp.org username; the commit carries their full name.
  const committerMap = new Map();
  for (const c of core) {
    if (!c.author || c.author === 'unknown') continue;
    const key = c.author.toLowerCase();
    const cur = committerMap.get(key) || { login: c.author, name: c.authorName || c.author, commits: 0 };
    cur.commits += 1;
    committerMap.set(key, cur);
  }
  const committers = [...committerMap.values()]
    .map((c) => ({ ...c, pct: core.length ? Math.round((c.commits / core.length) * 100) : 0 }))
    .sort((a, b) => b.commits - a.commits || cmp(a.login, b.login));

  // Optional: flag first-time contributors. "New" = a merged contribution in this
  // window but none in the `firstTimersMonths` months before it. This is an honest
  // approximation of "first ever" (bounded lookback, not all-time) - the label in
  // the UI says so. Costs a second commit fetch over the lookback window.
  let firstTimers = null;
  if (firstTimersMonths > 0) {
    const priorSince = shiftMonths(s, firstTimersMonths);
    const priorUntil = dayBefore(s);
    const prior = await fetchContributors({ since: priorSince, until: priorUntil, coreBranch, gbBranch });
    const priorSet = new Set(prior.byContributor.map((p) => p.name.toLowerCase()));
    let count = 0;
    for (const p of byContributor) {
      p.firstTimer = !priorSet.has(p.name.toLowerCase());
      if (p.firstTimer) count += 1;
    }
    firstTimers = { count, lookbackMonths: firstTimersMonths, since: priorSince, until: priorUntil };
  }

  // Optional: break the Core changes down by Trac component (cookie-free, via the
  // active-cycle dev-notes tracker). Opt-in because it costs extra fetches.
  let componentsData = null;
  if (components) {
    const { slug, map } = await fetchComponentMap();
    componentsData = { slug, ...componentBreakdown(core, map) };
  }

  return {
    meta: { since: s, until: u, coreBranch, gbBranch },
    core: { contributors: coreContribs, commits: core.length },
    gutenberg: { contributors: gbContribs, commits: gb.length },
    components: componentsData,
    committers,
    firstTimers,
    byContributor,
    timeline,
    totals: {
      contributors: tally.size,
      coreCommits: core.length,
      gutenbergCommits: gb.length,
    },
  };
}
