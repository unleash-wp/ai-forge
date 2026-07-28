// WordPress commit fetching (Core-shared). Extracted from the changelog plugin's
// github-queries so any plugin can pull Core (wordpress-develop) + Gutenberg
// commits for a window through the shared authed-fetch primitive, rather than
// re-implementing GitHub auth/pagination.
import { readFileSync, writeFileSync, renameSync, rmSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { githubFetch, nextLink } from '../connectors/github-token.mjs';

export const GB_REPO = 'WordPress/gutenberg';
export const CORE_REPO = 'WordPress/wordpress-develop';

// Disk cache for the (large) commit fetch. A window that ended before today is
// immutable, so it's cached indefinitely; a window that reaches today refreshes on
// a short TTL. Shared CACHE_DIR so a hosted ingest job + app reuse it. GitHub is
// authenticated (no block risk), so this is purely to cut request volume + latency.
const CACHE_DIR = process.env.UWP_CACHE_DIR || join(homedir(), '.config', 'uwp-ai-forge');
const COMMITS_DIR = join(CACHE_DIR, 'commits');
const TTL_MS = 30 * 60 * 1000; // windows touching today refresh every 30 min
const today = () => new Date().toISOString().slice(0, 10);

const cacheFile = (repo, branch, since, until) =>
  join(COMMITS_DIR, `${repo}@${branch}_${String(since).slice(0, 10)}_${String(until).slice(0, 10)}`.replace(/[^a-zA-Z0-9._-]+/g, '-') + '.json');

// Keep only the fields parseCommit reads, so a year window is a few MB not tens.
const trim = (c) => ({
  sha: c.sha,
  html_url: c.html_url,
  author: c.author ? { login: c.author.login } : null,
  commit: { message: c.commit?.message, author: { name: c.commit?.author?.name, date: c.commit?.author?.date } },
});

function readCommitsCache(file, until) {
  try {
    const { ts, commits } = JSON.parse(readFileSync(file, 'utf8'));
    const immutable = String(until).slice(0, 10) < today();
    if (immutable || Date.now() - ts < TTL_MS) return commits;
  } catch { /* miss */ }
  return null;
}
function writeCommitsCache(file, commits) {
  try {
    mkdirSync(COMMITS_DIR, { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify({ ts: Date.now(), commits }));
    renameSync(tmp, file);
  } catch { /* best effort */ }
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
