// WordPress commit fetching (Core-shared). Extracted from the changelog plugin's
// github-queries so any plugin can pull Core (wordpress-develop) + Gutenberg
// commits for a window through the shared authed-fetch primitive, rather than
// re-implementing GitHub auth/pagination.
import { githubFetch, nextLink } from '../connectors/github-token.mjs';

export const GB_REPO = 'WordPress/gutenberg';
export const CORE_REPO = 'WordPress/wordpress-develop';

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
