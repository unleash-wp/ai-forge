import { execFileSync } from 'node:child_process';

// Resolve a GitHub token: env first, then `gh auth token`. Null = unauthenticated.
function resolveToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

const TOKEN = resolveToken();
export const authenticated = !!TOKEN;

function headers() {
  const h = { Accept: 'application/vnd.github+json', 'User-Agent': 'wp-release-helper' };
  if (TOKEN) h.Authorization = `Bearer ${TOKEN}`;
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
    if (res.status === 403) hint = ' (rate limit — run `gh auth login` for 5000/h)';
    if (res.status === 404) hint = ' (repo or branch not found)';
    throw new Error(`GitHub ${res.status} ${res.statusText}${hint}: ${url}`);
  }
  return { data: await res.json(), link: res.headers.get('link') };
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
