import { apiJson } from '../../../src/connectors/github-token.mjs';

// The WordPress docs team triages each release into a per-release folder of
// component JSON files here - cookie-free, already component + classification
// tagged. We use it as the preferred Core categorization source.
const REPO = 'WordPress/Documentation-Issue-Tracker';

// "7.1" -> "7-1-dev-notes"
export function slugFor(milestone) {
  return `${String(milestone).replace(/\./g, '-')}-dev-notes`;
}

// Fetch the tracker for a milestone. Returns { slug, map, stats } where `map`
// is ticketId -> { component, type, classification, owner, summary, url }, or
// null when no tracker exists for that release yet.
export async function fetchTracker(milestone) {
  const slug = slugFor(milestone);

  let listing;
  try {
    listing = await apiJson(`repos/${REPO}/contents/${slug}/components`);
  } catch {
    return null; // no tracker for this release
  }

  const files = listing.filter((f) => f.name.endsWith('.json') && f.download_url);
  const map = new Map();
  await pool(files, 8, async (f) => {
    const data = await fetchRaw(f.download_url);
    for (const t of data.tickets || []) {
      map.set(t.id, {
        component: t.component,
        type: t.type,
        classification: t.classification,
        owner: t.owner,
        summary: t.summary,
        url: t.url,
      });
    }
  });

  let stats = null;
  try {
    const meta = await fetchRaw(`https://raw.githubusercontent.com/${REPO}/main/${slug}/release-metadata.json`);
    stats = meta.statistics?.by_classification ?? null;
  } catch {
    // release-metadata is optional; component map is enough.
  }

  return { slug, map, stats };
}

async function fetchRaw(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'ai-forge' } });
  if (!res.ok) throw new Error(`raw ${res.status} ${url}`);
  return res.json();
}

async function pool(items, concurrency, fn) {
  let i = 0;
  async function worker() {
    while (i < items.length) await fn(items[i++]);
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}
