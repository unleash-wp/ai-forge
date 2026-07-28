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
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { CACHE_DIR, OFFLINE, loadJson, saveJson } from './cache-store.mjs';
import { timeoutSignal, pool } from './net.mjs';

const UA = 'uwp-ai-forge contributors (+https://unleash-wp.com)';

export { OFFLINE }; // re-exported for callers that import it from here
const CACHE = join(CACHE_DIR, 'profile-cache-v3.json');
const SLUG_CACHE = join(CACHE_DIR, 'ghslug-cache-v1.json');
const loadCache = () => loadJson(CACHE);
const saveCache = (c) => saveJson(CACHE, c);
const loadSlugCache = () => loadJson(SLUG_CACHE);
const saveSlugCache = (c) => saveJson(SLUG_CACHE, c);

// Delete the cached wp.org data (profiles + slug map). Non-destructive: the next
// run just re-fetches. Returns how many entries were dropped (for a nice message).
export function clearCaches() {
  const profiles = Object.keys(loadCache()).length;
  const slugs = Object.keys(loadSlugCache()).length;
  for (const f of [CACHE, SLUG_CACHE]) { try { rmSync(f, { force: true }); } catch { /* ignore */ } }
  return { profiles, slugs, dir: CACHE_DIR };
}

// Optional request pacing: UWP_FETCH_RPS caps outbound requests to N/sec within
// this process, so a hosted ingestion job stays a good citizen. Pacing is
// per-process (single-writer ingest is the intended deployment); running several
// ingest workers would multiply the effective rate. 0/unset = no pacing (fine for
// interactive local use, which is already cached + bounded).
const RPS = Number(process.env.UWP_FETCH_RPS) || 0;
let nextSlot = 0;
async function paceGate() {
  if (RPS <= 0) return;
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + 1000 / RPS;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

// fetch that paces + backs off once when profiles.wordpress.org throttles us
// (429/503), honouring Retry-After, so a burst doesn't hammer Automattic's server.
async function politeFetch(url) {
  for (let attempt = 1; ; attempt++) {
    await paceGate();
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: timeoutSignal() });
    if ((res.status === 429 || res.status === 503) && attempt < 3) {
      const wait = Math.min((Number(res.headers.get('retry-after')) || attempt * 1.5) * 1000, 10000);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    return res;
  }
}

async function getText(url) {
  const res = await politeFetch(url);
  if (!res.ok) { const e = new Error(`${res.status} ${url}`); e.status = res.status; throw e; }
  return res.text();
}

// Map a GitHub login to a wp.org username via the official lookup endpoint, or
// null. This is how Gutenberg contributors (GitHub handles) join to profiles.
export async function githubToWporg(login) {
  if (OFFLINE) return null; // read-only host: never fetch profiles.wordpress.org
  const res = await politeFetch(`https://profiles.wordpress.org/wp-json/wporg-github/v1/lookup/${encodeURIComponent(login)}`);
  if (res.status === 404) return null;            // definitive: no such GitHub user / no mapping
  if (!res.ok) throw new Error(`lookup ${res.status}`); // transient: let the caller skip caching
  const j = await res.json();
  return j && j.slug ? j.slug : null;
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
  const out = { employer: null, avatar: null, memberSince: null };
  if (OFFLINE) return out; // read-only host: never fetch, just miss
  try {
    // encodeURIComponent so a slug can't manipulate the request path (defense in
    // depth; slugs come from commit data, not direct user input).
    const html = await getText(`https://profiles.wordpress.org/${encodeURIComponent(slug)}/`);
    Object.assign(out, { employer: parseEmployer(html), avatar: parseAvatar(html), memberSince: parseMemberSince(html) });
    if (cache) cache[slug] = out;
  } catch (e) {
    // Cache a definitive miss (404: no such profile); never cache a transient
    // failure (network / 5xx / bot wall) - it must retry on the next run.
    if (cache && e.status === 404) cache[slug] = out;
  }
  return out;
}

// GitHub-login -> wp.org-slug map: many contributors use a different handle on
// GitHub than on wp.org (GitHub "t-hamano" is wp.org "wildworks"), so the raw
// commit name is not a reliable profile slug or dedup key. (Cache defined above.)

// Canonical wp.org slug for a name, cached. Returns the wp.org username when the
// name is a GitHub login mapped to a profile, else the name unchanged.
async function canonicalSlug(name, slugCache) {
  if (!(name in slugCache)) {
    if (OFFLINE) return name; // read-only host: never fetch, keep the raw name
    // Only cache a resolved value or a definitive miss; a transient lookup failure
    // must not poison the cache (it would never retry that name again).
    try { slugCache[name] = (await githubToWporg(name)) || null; }
    catch { return name; }
  }
  return slugCache[name] || name;
}

// Merge a byContributor list by canonical wp.org identity, so the same person
// credited under a GitHub login (Gutenberg) and a wp.org username (Core) collapses
// into one entry. Sums props/core/gutenberg, unions their shipped items, sets the
// wp.org display name + slug. Returns the merged list ranked by props.
export async function resolveIdentities(byContributor, { concurrency = 6 } = {}) {
  const slugCache = loadSlugCache();
  // Only resolve names that came (even partly) from a Gutenberg GitHub login; pure
  // Core-Props names are already wp.org usernames, so skipping them halves the load
  // on profiles.wordpress.org and avoids a wrong remap of a coincidental handle.
  const needsLookup = [...new Set(byContributor.filter((c) => c.source !== 'core').map((c) => c.name))];
  await pool(needsLookup, concurrency, (name) => canonicalSlug(name, slugCache));
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

// Dedupe a flat list of contributor handles by canonical wp.org identity (for the
// changelog's props/credits list). Returns each person once as their wp.org
// username, sorted. Degrades to the raw handle when there's no mapping.
export async function canonicalNames(names, { concurrency = 6, lookupOnly = null } = {}) {
  const slugCache = loadSlugCache();
  const uniq = [...new Set(names)];
  // Only look up handles that are GitHub logins (lookupOnly); Core-Props names are
  // already wp.org usernames, so skipping them is gentler on profiles.wordpress.org.
  const toResolve = lookupOnly ? uniq.filter((n) => lookupOnly.has(n)) : uniq;
  await pool(toResolve, concurrency, (n) => canonicalSlug(n, slugCache));
  saveSlugCache(slugCache);
  const bySlug = new Map();
  for (const n of uniq) {
    const slug = slugCache[n] || n;
    bySlug.set(slug.toLowerCase(), slug);
  }
  return [...bySlug.values()].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

// Attach each Core committer's employer, avatar and join year from their wp.org
// profile, resolving the GitHub login to the wp.org slug first (they often differ).
// Shares the profile + slug caches, so overlapping runs are fast.
export async function enrichCommitters(committers, { concurrency = 6 } = {}) {
  const cache = loadCache();
  const slugCache = loadSlugCache();
  const out = new Array(committers.length);
  let i = 0;
  async function worker() {
    while (i < committers.length) {
      const idx = i++;
      const c = committers[idx];
      const slug = (await canonicalSlug(c.login, slugCache)).toLowerCase(); // match resolveIdentities' slug casing
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
export async function companyBreakdown(byContributor, { concurrency = 6 } = {}) {
  const cache = loadCache();
  const resolved = new Array(byContributor.length);
  let i = 0;
  async function worker() {
    while (i < byContributor.length) {
      const idx = i++;
      const c = byContributor[idx];
      // Prefer the canonical slug from resolveIdentities; fall back for direct callers
      // (guarded: githubToWporg throws on a transient failure).
      let slug = c.slug;
      if (!slug) { try { slug = c.source === 'gutenberg' ? await githubToWporg(c.name) : c.name; } catch { slug = c.name; } }
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
