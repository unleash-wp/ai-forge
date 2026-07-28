// WordPress.org contributor profiles (Core-shared, plugin-facing API).
//
// Resolves a contributor to their CURRENT EMPLOYER — for "which company invested
// most" analysis — and maps Gutenberg GitHub logins to wp.org usernames.
//
// Honest limits (verified against live profiles, not assumed):
//   - Employer comes from the profile's job-history entry marked "Present".
//     Coverage is partial: ~83% of top contributors list one, less on the long
//     tail. Contributors without one fall into an "Unknown / not listed" bucket.
//   - LOCATION / country is NOT reliably present on wp.org profiles and is NOT
//     resolved here. Don't fabricate it — a geography feature needs another source.
//   - Employer is the person's job, a good but imperfect proxy for the Five for
//     the Future *sponsor* (which is not exposed in the static profile HTML).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

const UA = 'uwp-ai-forge contributors (+https://unleash-wp.com)';
const CACHE = join(homedir(), '.config', 'uwp-ai-forge', 'profile-cache.json');

function loadCache() {
  try { return JSON.parse(readFileSync(CACHE, 'utf8')); } catch { return {}; }
}
function saveCache(c) {
  try { mkdirSync(dirname(CACHE), { recursive: true }); writeFileSync(CACHE, JSON.stringify(c)); } catch { /* best effort */ }
}

async function getText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

// Map a GitHub login to a wp.org username via the official lookup endpoint, or
// null. This is how Gutenberg contributors (GitHub handles) join to profiles.
export async function githubToWporg(login) {
  try {
    const res = await fetch(
      `https://profiles.wordpress.org/wp-json/wporg-github/v1/lookup/${encodeURIComponent(login)}`,
      { headers: { 'User-Agent': UA } },
    );
    if (!res.ok) return null;
    const j = await res.json();
    return j && j.slug ? j.slug : null;
  } catch { return null; }
}

// Current employer from a wp.org profile's job history: the `company` of the job
// entry whose dates say "Present". null if none is listed.
export function parseEmployer(html) {
  const entries = [...html.matchAll(/<div class="dates">([\s\S]*?)<\/div>[\s\S]*?<div class="company">([\s\S]*?)<\/div>/g)];
  for (const [, dates, company] of entries) {
    if (/present/i.test(dates)) {
      // The company div also carries a "· Full-time" employment-type span — drop
      // it and keep just the employer name.
      const name = company
        .replace(/<span class="employment-type">[\s\S]*?<\/span>/gi, '')
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/\s*(?:&middot;|·).*$/s, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (name) return name;
    }
  }
  return null;
}

export async function employerOf(slug, cache) {
  if (cache && slug in cache) return cache[slug];
  let employer = null;
  try { employer = parseEmployer(await getText(`https://profiles.wordpress.org/${slug}/`)); } catch { /* leave null */ }
  if (cache) cache[slug] = employer;
  return employer;
}

// Resolve employers for a byContributor list ([{ name, props, source }]) and
// aggregate credited contributions per company. Returns { byCompany, resolved,
// coverage }. Bounded concurrency; results cached to disk across runs so a second
// run of an overlapping window is fast and gentle on profiles.wordpress.org.
export async function companyBreakdown(byContributor, { concurrency = 6 } = {}) {
  const cache = loadCache();
  const resolved = new Array(byContributor.length);
  let i = 0;
  async function worker() {
    while (i < byContributor.length) {
      const idx = i++;
      const c = byContributor[idx];
      const slug = c.source === 'gutenberg' ? await githubToWporg(c.name) : c.name;
      const employer = slug ? await employerOf(slug, cache) : null;
      resolved[idx] = { ...c, slug, employer };
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, byContributor.length || 1) }, worker));
  saveCache(cache);

  // Normalise: "Open to work" is a job-seeking status, not an employer; and group
  // case/punctuation-insensitively so "Self employed" / "Self-employed" don't
  // split. Display name = the first spelling seen for each group.
  const canon = (name) => {
    if (!name) return null;
    const clean = name.replace(/\s+/g, ' ').trim();
    return /^open to work$/i.test(clean) ? null : clean;
  };
  const totals = new Map();
  let peopleKnown = 0;
  for (const r of resolved) {
    const employer = canon(r.employer);
    if (employer) peopleKnown++;
    const key = employer ? employer.toLowerCase().replace(/[^a-z0-9]+/g, '') : '__unknown__';
    const display = employer || 'Unknown / not listed';
    const cur = totals.get(key) || { company: display, contributions: 0, people: 0 };
    cur.contributions += r.props;
    cur.people += 1;
    totals.set(key, cur);
  }
  const byCompany = [...totals.values()].sort((a, b) => b.contributions - a.contributions);
  return {
    byCompany,
    resolved,
    coverage: {
      peopleKnown,
      peopleTotal: resolved.length,
      pct: resolved.length ? Math.round((peopleKnown / resolved.length) * 100) : 0,
    },
  };
}
