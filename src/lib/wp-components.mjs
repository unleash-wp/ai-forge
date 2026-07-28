// WordPress Core component breakdown (Core-shared, cookie-free, plugin-facing).
//
// Maps Core changesets to their Trac component using the WordPress docs team's
// dev-notes tracker (WordPress/Documentation-Issue-Tracker), which tags every
// triaged ticket with its component - no Trac cookie needed. The repo only keeps
// the *active* release cycle's tracker, so component data is available for
// windows in the current cycle; older windows fall back to "Uncategorized".
// `coverage` reports how many Core changes were categorized, so the caller can be
// honest about it.
//
// Usage (any plugin):
//   import { fetchComponentMap, componentBreakdown } from '../../../src/lib/wp-components.mjs';
//   const { slug, map } = await fetchComponentMap();
//   const { byComponent, coverage } = componentBreakdown(coreCommits, map);
import { apiJson } from '../connectors/github-token.mjs';
import { timeoutSignal, pool } from './net.mjs';

const REPO = 'WordPress/Documentation-Issue-Tracker';

// Build ticketId -> component for the newest dev-notes tracker in the repo.
// Returns { slug, map }; slug is null (and map empty) when no tracker is present.
export async function fetchComponentMap() {
  let root;
  try { root = await apiJson(`repos/${REPO}/contents`); } catch { return { slug: null, map: new Map() }; }

  const slug = root
    .filter((f) => f.type === 'dir' && /-dev-notes$/.test(f.name))
    .map((f) => ({ slug: f.name, v: f.name.replace('-dev-notes', '').split('-').map(Number) }))
    .sort((a, b) => (b.v[0] - a.v[0]) || (b.v[1] - a.v[1]))[0]?.slug;
  if (!slug) return { slug: null, map: new Map() };

  let files;
  try { files = await apiJson(`repos/${REPO}/contents/${slug}/components`); } catch { return { slug: null, map: new Map() }; }
  const jsonFiles = files.filter((f) => f.name.endsWith('.json') && f.download_url);

  const map = new Map();
  await pool(jsonFiles, 8, async (f) => {
    // One flaky component file must not sink the whole breakdown - skip it.
    let data;
    try { data = await fetchRaw(f.download_url); } catch { return; }
    for (const t of data.tickets || []) if (t.component) map.set(t.id, t.component);
  });
  return { slug, map };
}

// Group parsed Core commits by component. Each commit's ticket ids are looked up
// in the map (first hit wins); commits with no mapped ticket land in
// "Uncategorized". Returns components ranked by change count + a coverage summary.
export function componentBreakdown(core, map) {
  const groups = new Map();
  let known = 0;
  for (const c of core) {
    const hit = (c.tickets || []).map((id) => map.get(id)).find(Boolean);
    if (hit) known += 1;
    const key = hit || 'Uncategorized';
    groups.set(key, (groups.get(key) || 0) + 1);
  }
  const byComponent = [...groups.entries()]
    .map(([component, count]) => ({ component, count }))
    .sort((a, b) => b.count - a.count || a.component.localeCompare(b.component));
  const total = core.length;
  return { byComponent, coverage: { known, total, pct: total ? Math.round((known / total) * 100) : 0 } };
}

async function fetchRaw(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'ai-forge' }, signal: timeoutSignal() });
  if (!res.ok) throw new Error(`raw ${res.status}`);
  return res.json();
}

