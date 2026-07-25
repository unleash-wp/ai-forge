// Changelog plugin: GitHub *queries* (commits, labels, branch lists). Auth lives
// in the Core connector (src/connectors/github-token.mjs); this module runs its
// REST reads through that connector's shared authed-fetch primitive
// (githubFetch / nextLink / apiJson) rather than re-implementing auth.
import { execFileSync } from 'node:child_process';
import { githubFetch, nextLink, apiJson } from '../../../src/connectors/github-token.mjs';

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
    const { data, link } = await githubFetch(url);
    out.push(...data);
    url = nextLink(link);
  }
  return out;
}

// Branch names via the git protocol (git ls-remote). This is NOT subject to the
// REST API rate limit, so the milestone/branch pickers keep working even when the
// token is throttled. Returns every head; ranking below floats trunk + wp/*.
function gitLsRemote(repo) {
  const out = execFileSync('git', ['ls-remote', '--heads', `https://github.com/${repo}.git`],
    { encoding: 'utf8', timeout: 20000, maxBuffer: 8 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  const names = [];
  for (const line of out.split('\n')) {
    const m = /\srefs\/heads\/(.+)$/.exec(line);
    if (m) names.push(m[1]);
  }
  return names;
}

// REST fallback (used only if git is unavailable / ls-remote fails).
async function branchesViaRest(repo) {
  const names = new Set();
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
    const { data, link } = await githubFetch(url);
    for (const b of data) names.add(b.name);
    url = nextLink(link);
    pages++;
  }
  return names;
}

// Branch names for a repo, trunk first, then wp/x.y and version branches ahead of
// the long tail so the picker is useful. git ls-remote first (no rate limit).
export async function branches(repo) {
  let names;
  try {
    const list = gitLsRemote(repo);
    if (list.length) names = new Set(list);
  } catch { /* fall back to REST */ }
  if (!names) names = await branchesViaRest(repo);
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
        const { data } = await githubFetch(`https://api.github.com/repos/${repo}/issues/${n}/labels`);
        result.set(n, data.map((l) => l.name));
      } catch {
        result.set(n, []);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, numbers.length) }, worker));
  return result;
}
