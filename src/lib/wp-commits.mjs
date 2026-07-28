// WordPress commit fetching (Core-shared). Extracted from the changelog plugin's
// github-queries so any plugin can pull Core (wordpress-develop) + Gutenberg
// commits for a window through the shared authed-fetch primitive, rather than
// re-implementing GitHub auth/pagination.
import { rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { githubFetch, nextLink } from '../connectors/github-token.mjs';
import { CACHE_DIR, loadJson, saveJson } from './cache-store.mjs';

export const GB_REPO = 'WordPress/gutenberg';
export const CORE_REPO = 'WordPress/wordpress-develop';

// Disk cache for the (large) commit fetch. A window is frozen only once its
// snapshot was fetched after the window ended (so an incomplete "today" snapshot is
// never frozen); otherwise it refreshes on a short TTL. Shared CACHE_DIR so a hosted
// ingest job + app reuse it. GitHub is authenticated (no block risk), so this is
// purely to cut request volume + latency.
const COMMITS_DIR = join(CACHE_DIR, 'commits');
const TTL_MS = 30 * 60 * 1000; // windows not yet closed refresh every 30 min

// Hash the raw key so distinct branches (e.g. wp/7.1 vs wp-7.1) never collide on a
// lossy-sanitised filename.
const cacheFile = (repo, branch, since, until) =>
  join(COMMITS_DIR, createHash('sha1').update(`${repo}@${branch}_${String(since).slice(0, 10)}_${String(until).slice(0, 10)}`).digest('hex').slice(0, 20) + '.json');

// Keep only the fields parseCommit reads, so a year window is a few MB not tens.
const trim = (c) => ({
  sha: c.sha,
  html_url: c.html_url,
  author: c.author ? { login: c.author.login } : null,
  commit: { message: c.commit?.message, author: { name: c.commit?.author?.name, date: c.commit?.author?.date } },
});

function readCommitsCache(file, until) {
  const entry = loadJson(file);
  if (!entry.ts || !entry.commits) return null;
  // Immutable once the snapshot was taken after the window closed; else honour TTL.
  const immutable = Date.parse(until) < entry.ts;
  if (immutable || Date.now() - entry.ts < TTL_MS) return entry.commits;
  return null;
}
function writeCommitsCache(file, commits) {
  saveJson(file, { ts: Date.now(), commits });
}

// Remove all cached commit windows. Returns how many were dropped.
export function clearCommitsCache() {
  let n = 0;
  try { for (const f of readdirSync(COMMITS_DIR)) if (f.endsWith('.json')) { rmSync(join(COMMITS_DIR, f), { force: true }); n += 1; } } catch { /* none */ }
  return n;
}

// All commits on `branch` of `repo` within [since, until] (ISO 8601), following
// pagination. Cached on disk (see above).
export async function commits(repo, branch, since, until) {
  const file = cacheFile(repo, branch, since, until);
  const cached = readCommitsCache(file, until);
  if (cached) return cached;

  const start = new URL(`https://api.github.com/repos/${repo}/commits`);
  start.searchParams.set('sha', branch);
  start.searchParams.set('since', since);
  start.searchParams.set('until', until);
  start.searchParams.set('per_page', '100');

  const out = [];
  let url = start.toString();
  while (url) {
    const { data, link } = await githubFetch(url);
    out.push(...data.map(trim));
    url = nextLink(link);
  }
  writeCommitsCache(file, out);
  return out;
}

// Date-only -> full-day bounds; ISO strings pass through untouched. A shape-valid
// but impossible date (2026-13-45) is rejected here with a clear message instead
// of being forwarded to GitHub and surfacing as a raw 422.
export function normDate(v, isEnd) {
  if (!v || v === true) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (m) {
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
      throw new Error(`invalid date: ${v} (use YYYY-MM-DD)`);
    }
    return `${v}T${isEnd ? '23:59:59' : '00:00:00'}Z`;
  }
  return v;
}
