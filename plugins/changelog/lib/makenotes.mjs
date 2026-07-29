// Published dev notes for a milestone, straight from make.wordpress.org/core via
// its WordPress REST API - the precise, tagged Field Guide source. Each release's
// dev notes carry the tag `dev-notes-<x-y>` (e.g. dev-notes-7-1); we resolve the
// tag id, then list its posts. Cookie-free and exact (the MCP make search is only
// keyword-fuzzy, so this is the right tool for dev notes). Cached per milestone.
import { timeoutSignal } from '../../../src/lib/net.mjs';

const BASE = 'https://make.wordpress.org/core/wp-json/wp/v2';
const cache = new Map();

const decode = (s) => String(s)
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&hellip;/g, '…').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n));
const strip = (s) => decode(String(s).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

export async function fetchDevNotes(milestone) {
  const version = String(milestone || '').trim();
  if (!version) return [];
  if (cache.has(version)) return cache.get(version);
  const slug = 'dev-notes-' + version.replace(/\./g, '-');
  const tags = await (await fetch(`${BASE}/tags?slug=${encodeURIComponent(slug)}`, { signal: timeoutSignal() })).json();
  if (!Array.isArray(tags) || !tags.length) { cache.set(version, []); return []; }
  const posts = await (await fetch(`${BASE}/posts?tags=${tags[0].id}&per_page=100&_fields=title,link,date,excerpt`, { signal: timeoutSignal() })).json();
  const out = (Array.isArray(posts) ? posts : []).map((p) => ({
    title: decode(p.title && p.title.rendered || ''),
    url: p.link,
    date: (p.date || '').slice(0, 10),
    excerpt: strip(p.excerpt && p.excerpt.rendered || '').slice(0, 220),
  }));
  cache.set(version, out);
  return out;
}
