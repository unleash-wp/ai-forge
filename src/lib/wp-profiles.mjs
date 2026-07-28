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
const CACHE = join(homedir(), '.config', 'uwp-ai-forge', 'profile-cache-v3.json');

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

// Join year from the profile's "Member Since" line (or null). The profile prints
// e.g. "Member Since: October 28th, 2011"; we keep the year.
export function parseMemberSince(html) {
  const m = html.match(/Member Since:\s*<\/span>\s*<strong>([\s\S]*?)<\/strong>/i);
  if (!m) return null;
  const y = m[1].match(/\b(?:19|20)\d{2}\b/);
  return y ? Number(y[0]) : null;
}

// Gravatar avatar URL from the profile HTML (or null), normalised to 120px.
export function parseAvatar(html) {
  const m = html.match(/(?:https?:)?\/\/(?:secure\.|www\.)?gravatar\.com\/avatar\/[0-9a-f]+/i);
  if (!m) return null;
  const url = m[0].startsWith('//') ? `https:${m[0]}` : m[0];
  return `${url}?s=120&d=mp`;
}

// One profile fetch -> { employer, avatar, memberSince }, cached to disk.
export async function profileOf(slug, cache) {
  if (cache && slug in cache) {
    const v = cache[slug];
    return typeof v === 'string' ? { employer: v, avatar: null, memberSince: null } : v;
  }
  let out = { employer: null, avatar: null, memberSince: null };
  try {
    const html = await getText(`https://profiles.wordpress.org/${slug}/`);
    out = { employer: parseEmployer(html), avatar: parseAvatar(html), memberSince: parseMemberSince(html) };
  } catch { /* leave nulls */ }
  if (cache) cache[slug] = out;
  return out;
}

// GitHub-login -> wp.org-slug cache. Many contributors use a different handle on
// GitHub than on wp.org (e.g. GitHub "t-hamano" is wp.org "wildworks"), so the raw
// commit name is not a reliable profile slug or dedup key.
const SLUG_CACHE = join(homedir(), '.config', 'uwp-ai-forge', 'ghslug-cache-v1.json');
function loadSlugCache() { try { return JSON.parse(readFileSync(SLUG_CACHE, 'utf8')); } catch { return {}; } }
function saveSlugCache(c) { try { mkdirSync(dirname(SLUG_CACHE), { recursive: true }); writeFileSync(SLUG_CACHE, JSON.stringify(c)); } catch { /* best effort */ } }

// Canonical wp.org slug for a name, cached. Returns the wp.org username when the
// name is a GitHub login mapped to a profile, else the name unchanged.
async function canonicalSlug(name, slugCache) {
  if (!(name in slugCache)) slugCache[name] = (await githubToWporg(name)) || null;
  return slugCache[name] || name;
}

async function pool(items, concurrency, fn) {
  let i = 0;
  const worker = async () => { while (i < items.length) await fn(items[i++]); };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length || 1) }, worker));
}

// Merge a byContributor list by canonical wp.org identity, so the same person
// credited under a GitHub login (Gutenberg) and a wp.org username (Core) collapses
// into one entry. Sums props/core/gutenberg, unions their shipped items, sets the
// wp.org display name + slug. Returns the merged list ranked by props.
export async function resolveIdentities(byContributor, { concurrency = 10 } = {}) {
  const slugCache = loadSlugCache();
  const names = [...new Set(byContributor.map((c) => c.name))];
  await pool(names, concurrency, (name) => canonicalSlug(name, slugCache));
  saveSlugCache(slugCache);
  const slugOf = (name) => (slugCache[name] || name).toLowerCase();

  const merged = new Map();
  for (const c of byContributor) {
    const key = slugOf(c.name);
    let cur = merged.get(key);
    if (!cur) { cur = { name: c.name, slug: key, props: 0, core: 0, gutenberg: 0, source: 'core', items: [] }; merged.set(key, cur); }
    cur.props += c.props || 0;
    cur.core += c.core || 0;
    cur.gutenberg += c.gutenberg || 0;
    if (c.name.toLowerCase() === key) cur.name = c.name; // prefer the wp.org-username spelling
    for (const it of (c.items || [])) cur.items.push(it);
  }
  return [...merged.values()]
    .map((c) => ({
      ...c,
      source: c.core > 0 && c.gutenberg > 0 ? 'both' : c.gutenberg > 0 ? 'gutenberg' : 'core',
      items: c.items.sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 100),
    }))
    .sort((a, b) => b.props - a.props || a.name.localeCompare(b.name));
}

// Attach each Core committer's employer, avatar and join year from their wp.org
// profile, resolving the GitHub login to the wp.org slug first (they often differ).
// Shares the profile + slug caches, so overlapping runs are fast.
export async function enrichCommitters(committers, { concurrency = 10 } = {}) {
  const cache = loadCache();
  const slugCache = loadSlugCache();
  const out = new Array(committers.length);
  let i = 0;
  async function worker() {
    while (i < committers.length) {
      const idx = i++;
      const c = committers[idx];
      const slug = await canonicalSlug(c.login, slugCache);
      const prof = await profileOf(slug, cache);
      out[idx] = { ...c, slug, employer: prof.employer, avatar: prof.avatar, memberSince: prof.memberSince ?? null };
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, committers.length || 1) }, worker));
  saveCache(cache); saveSlugCache(slugCache);
  return out;
}

// Resolve employers for a byContributor list ([{ name, props, source }]) and
// aggregate credited contributions per company. Returns { byCompany, resolved,
// coverage }. Bounded concurrency; results cached to disk across runs so a second
// run of an overlapping window is fast and gentle on profiles.wordpress.org.
export async function companyBreakdown(byContributor, { concurrency = 10 } = {}) {
  const cache = loadCache();
  const resolved = new Array(byContributor.length);
  let i = 0;
  async function worker() {
    while (i < byContributor.length) {
      const idx = i++;
      const c = byContributor[idx];
      // Prefer the canonical slug from resolveIdentities; fall back for direct callers.
      const slug = c.slug || (c.source === 'gutenberg' ? await githubToWporg(c.name) : c.name);
      const prof = slug ? await profileOf(slug, cache) : { employer: null, avatar: null };
      resolved[idx] = { ...c, slug, employer: prof.employer, avatar: prof.avatar };
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
