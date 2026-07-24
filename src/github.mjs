import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

// Local config file for a saved GitHub token - same owner-only dir as the Trac
// cookie, outside any repo so it is never committed by accident.
export function tokenPath() {
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(base, 'wp-trac', 'github-token');
}

// Persist a token pasted in the setup wizard (owner-only). Returns the path.
export function saveToken(value) {
  const p = tokenPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, value.trim() + '\n', { mode: 0o600 });
  return p;
}

// Remove the saved token file (the setup wizard's Disconnect). No-op if absent.
export function deleteToken() {
  try { unlinkSync(tokenPath()); return true; } catch { return false; }
}

function readSavedToken() {
  try {
    const v = readFileSync(tokenPath(), 'utf8').trim();
    return v || null;
  } catch {
    return null;
  }
}

// Shelling out to `gh` is slow, so resolve it at most once per process.
let ghCliToken;
function ghCli() {
  if (ghCliToken === undefined) {
    try {
      ghCliToken = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
    } catch {
      ghCliToken = null;
    }
  }
  return ghCliToken;
}

// Resolution order: GITHUB_TOKEN env, then the saved token file, then `gh auth
// token`. Read live so the setup wizard takes effect without a restart.
export function resolveToken() {
  if (process.env.GITHUB_TOKEN) return { token: process.env.GITHUB_TOKEN.trim(), source: 'env' };
  const f = readSavedToken();
  if (f) return { token: f, source: 'file' };
  const gh = ghCli();
  if (gh) return { token: gh, source: 'gh' };
  return { token: null, source: 'none' };
}

export function tokenStatus() {
  const { token, source } = resolveToken();
  return { set: !!token, source, path: tokenPath(), envLocked: !!process.env.GITHUB_TOKEN };
}

export function authenticated() {
  return !!resolveToken().token;
}

// Cheap auth probe for the wizard's Test button: hit the rate_limit endpoint
// (never counts against the limit) and report the ceiling it gives back.
export async function checkToken() {
  const { token, source } = resolveToken();
  if (!token) return { ok: false, message: 'No token - GitHub API limited to 60 req/h.' };
  const res = await fetch('https://api.github.com/rate_limit', { headers: headers() });
  if (res.status === 401) return { ok: false, message: 'GitHub rejected the token (401 - expired or wrong value).' };
  if (!res.ok) return { ok: false, message: `GitHub ${res.status} ${res.statusText}.` };
  const d = await res.json();
  const core = (d.resources && d.resources.core) || d.rate || {};
  return { ok: true, source, message: `Token works - ${core.limit}/h limit (${core.remaining} left).` };
}

function headers() {
  const h = { Accept: 'application/vnd.github+json', 'User-Agent': 'wp-release-helper' };
  const { token } = resolveToken();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

function nextLink(linkHeader) {
  if (!linkHeader) return null;
  const part = linkHeader.split(',').find((s) => s.includes('rel="next"'));
  const m = part && part.match(/<([^>]+)>/);
  return m ? m[1] : null;
}

async function getJson(url) {
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    let hint = '';
    if (res.status === 403) {
      hint = resolveToken().token
        ? ' (GitHub rate limit reached even at 5000/h - resets within the hour, try again shortly)'
        : ' (rate limit - run `gh auth login` for 5000/h)';
    }
    if (res.status === 404) hint = ' (repo or branch not found)';
    throw new Error(`GitHub ${res.status} ${res.statusText}${hint}: ${url}`);
  }
  return { data: await res.json(), link: res.headers.get('link') };
}

// Single GET against the REST API; returns parsed JSON (throws on non-2xx, e.g. 404).
export async function apiJson(path) {
  const { data } = await getJson(`https://api.github.com/${path}`);
  return data;
}

// All commits on `branch` of `repo` within [since, until] (ISO 8601), following pagination.
export async function commits(repo, branch, since, until) {
  const start = new URL(`https://api.github.com/repos/${repo}/commits`);
  start.searchParams.set('sha', branch);
  start.searchParams.set('since', since);
  start.searchParams.set('until', until);
  start.searchParams.set('per_page', '100');

  const out = [];
  let url = start.toString();
  while (url) {
    const { data, link } = await getJson(url);
    out.push(...data);
    url = nextLink(link);
  }
  return out;
}

// Branch names for a repo (up to a few pages), trunk first, then wp/x.y and
// version branches surfaced ahead of the long tail so the picker is useful.
export async function branches(repo) {
  const names = new Set();
  // Guarantee the release-relevant Gutenberg branches (wp/*) even though the repo
  // has hundreds of branches - the plain listing could page them out.
  if (repo.endsWith('/gutenberg')) {
    try {
      const refs = await apiJson(`repos/${repo}/git/matching-refs/heads/wp/`);
      for (const r of refs) names.add(r.ref.replace('refs/heads/', ''));
    } catch { /* ignore */ }
    names.add('trunk');
  }
  let url = `https://api.github.com/repos/${repo}/branches?per_page=100`;
  let pages = 0;
  while (url && pages < 4) {
    const { data, link } = await getJson(url);
    for (const b of data) names.add(b.name);
    url = nextLink(link);
    pages++;
  }
  const rank = (n) => (n === 'trunk' ? 0 : /^(wp\/|\d+\.\d)/.test(n) ? 1 : 2);
  return [...names].sort((a, b) => rank(a) - rank(b) || b.localeCompare(a));
}

// Label names for a list of issue/PR numbers, fetched with a bounded concurrency pool.
export async function labelsFor(repo, numbers, concurrency = 8) {
  const result = new Map();
  let i = 0;
  async function worker() {
    while (i < numbers.length) {
      const n = numbers[i++];
      try {
        const { data } = await getJson(`https://api.github.com/repos/${repo}/issues/${n}/labels`);
        result.set(n, data.map((l) => l.name));
      } catch {
        result.set(n, []);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, numbers.length) }, worker));
  return result;
}
