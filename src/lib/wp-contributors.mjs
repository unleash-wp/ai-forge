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

const cmp = (a, b) => a.toLowerCase().localeCompare(b.toLowerCase());

export async function fetchContributors({ since, until, coreBranch = 'trunk', gbBranch = 'trunk' } = {}) {
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
  const tally = new Map();
  const bump = (name, source, item) => {
    const cur = tally.get(name) || { name, props: 0, source, items: [] };
    cur.props += 1;
    if (cur.source !== source) cur.source = 'both';
    if (cur.items.length < ITEM_CAP) cur.items.push(item);
    tally.set(name, cur);
  };
  for (const c of core) {
    const item = { repo: 'core', subject: c.subject, url: c.url, ref: c.changeset ? `r${c.changeset}` : c.shortSha };
    for (const p of c.props) bump(p, 'core', item);
  }
  for (const c of gb) {
    if (!c.author || c.author === 'unknown') continue;
    bump(c.author, 'gutenberg', { repo: 'gutenberg', subject: c.subject, url: c.url, ref: c.pr ? `#${c.pr}` : c.shortSha });
  }

  const byContributor = [...tally.values()]
    .sort((a, b) => b.props - a.props || cmp(a.name, b.name));

  const coreContribs = [...new Set(core.flatMap((c) => c.props))].sort(cmp);
  const gbContribs = [...new Set(gb.map((c) => c.author).filter((a) => a && a !== 'unknown'))].sort(cmp);
  const all = new Set([...coreContribs, ...gbContribs]);

  return {
    meta: { since: s, until: u, coreBranch, gbBranch },
    core: { contributors: coreContribs, commits: core.length },
    gutenberg: { contributors: gbContribs, commits: gb.length },
    byContributor,
    totals: {
      contributors: all.size,
      coreCommits: core.length,
      gutenbergCommits: gb.length,
    },
  };
}
