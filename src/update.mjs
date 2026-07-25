// Free self-update check: compare each plugin's manifest version against the
// latest GitHub Release of its updateSource. Read-only - it only surfaces a
// "update available" note with a link. It never downloads or runs remote code
// (that would be a security hole); the user updates via git / their own flow.
import { resolveToken } from './connectors/github-token.mjs';

function parseSource(src) {
  const m = /^github:([^/]+)\/(.+)$/.exec(src || '');
  return m ? { owner: m[1], repo: m[2] } : null;
}

// Compare dotted versions; returns 1 when b is newer than a, else 0/-1.
function cmp(a, b) {
  const pa = String(a).replace(/^v/, '').split('.').map(Number);
  const pb = String(b).replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (y > x) return 1;
    if (y < x) return -1;
  }
  return 0;
}

async function latestRelease(owner, repo, token) {
  const headers = { 'User-Agent': 'ai-forge', Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, { headers });
  if (r.status === 404) return null; // no releases published yet
  if (!r.ok) throw new Error('GitHub ' + r.status);
  const d = await r.json();
  return { tag: d.tag_name, url: d.html_url };
}

// plugins: [{ manifest }]. Returns [{ id, name, current, latest, url }] for the
// ones whose source has a newer release. Fetches each source once.
export async function checkUpdates(plugins) {
  const token = resolveToken();
  const cache = new Map();
  const out = [];
  for (const p of plugins) {
    const m = p.manifest;
    const src = parseSource(m.updateSource);
    if (!src) continue;
    const key = src.owner + '/' + src.repo;
    if (!cache.has(key)) cache.set(key, await latestRelease(src.owner, src.repo, token).catch(() => null));
    const rel = cache.get(key);
    if (rel && rel.tag && cmp(m.version, rel.tag) === 1) {
      out.push({ id: m.id, name: m.name, current: m.version, latest: rel.tag.replace(/^v/, ''), url: rel.url });
    }
  }
  return out;
}
