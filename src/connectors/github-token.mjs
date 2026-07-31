// Core connector: the GitHub token. Owns the credential store (path/save/delete/
// resolve, gh-CLI fallback, disconnect marker, status/probe) so the Core shell can
// drive setup without importing a tool. It also exports the shared *authenticated
// fetch primitive* (authedHeaders / githubFetch / nextLink / apiJson) so tool
// plugins run REST queries through one auth path instead of re-implementing it.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { timeoutSignal } from '../lib/net.mjs';

// Local config file for a saved GitHub token - same owner-only dir as the Trac
// cookie, outside any repo so it is never committed by accident.
export function tokenPath() {
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(base, 'wp-trac', 'github-token');
}

// Marker that the user explicitly disconnected GitHub. It lets Disconnect work
// even when the token comes from the `gh` CLI (which we can't and shouldn't log
// out system-wide) - resolveToken() ignores the file + gh CLI while it exists.
function disabledPath() {
  return tokenPath() + '.off';
}
export function isDisabled() {
  return existsSync(disabledPath());
}
export function setDisabled(off) {
  const p = disabledPath();
  if (off) { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, '', { mode: 0o600 }); }
  else { try { unlinkSync(p); } catch { /* already gone */ } }
}

// Persist a token pasted in the setup wizard (owner-only). Clears the disconnect
// marker so the new token takes effect. Returns the path.
export function saveToken(value) {
  const p = tokenPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, value.trim() + '\n', { mode: 0o600 });
  setDisabled(false);
  return p;
}

// Remove the saved token file (the setup wizard's Disconnect). No-op if absent.
export function deleteToken() {
  try { unlinkSync(tokenPath()); return true; } catch { return false; }
}

// Is a `gh` CLI login available to (re)connect with one click?
export function ghAvailable() {
  return !!ghCli();
}

function readSavedToken() {
  try {
    const v = readFileSync(tokenPath(), 'utf8').trim();
    return v || null;
  } catch {
    return null;
  }
}

// Shelling out to `gh` is slow, so resolve it at most once per process.
let ghCliToken;
function ghCli() {
  if (ghCliToken === undefined) {
    try {
      ghCliToken = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
    } catch {
      ghCliToken = null;
    }
  }
  return ghCliToken;
}

// Resolution order: GITHUB_TOKEN env, then the saved token file, then `gh auth
// token`. Read live so the setup wizard takes effect without a restart.
export function resolveToken() {
  if (process.env.GITHUB_TOKEN) return { token: process.env.GITHUB_TOKEN.trim(), source: 'env' };
  if (isDisabled()) return { token: null, source: 'none' };
  const f = readSavedToken();
  if (f) return { token: f, source: 'file' };
  const gh = ghCli();
  if (gh) return { token: gh, source: 'gh' };
  return { token: null, source: 'none' };
}

export function tokenStatus() {
  const { token, source } = resolveToken();
  return { set: !!token, source, path: tokenPath(), envLocked: !!process.env.GITHUB_TOKEN, ghAvailable: ghAvailable() };
}

export function authenticated() {
  return !!resolveToken().token;
}

// Cheap auth probe for the wizard's Test button: hit the rate_limit endpoint
// (never counts against the limit) and report the ceiling it gives back.
export async function checkToken() {
  const { token, source } = resolveToken();
  if (!token) return { ok: false, message: 'No token - GitHub API limited to 60 req/h.' };
  const res = await fetch('https://api.github.com/rate_limit', { headers: authedHeaders(), signal: timeoutSignal() });
  if (res.status === 401) return { ok: false, message: 'GitHub rejected the token (401 - expired or wrong value).' };
  if (!res.ok) return { ok: false, message: `GitHub ${res.status} ${res.statusText}.` };
  const d = await res.json();
  const core = (d.resources && d.resources.core) || d.rate || {};
  return { ok: true, source, message: `Token works - ${core.limit}/h limit (${core.remaining} left).` };
}

// --- Shared authenticated-fetch primitive (used by tool plugins) ---------------

// REST headers with the resolved token applied (Bearer) when one exists.
export function authedHeaders() {
  const h = { Accept: 'application/vnd.github+json', 'User-Agent': 'ai-forge' };
  const { token } = resolveToken();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

// The `Link: …; rel="next"` URL for cursor pagination, or null at the last page.
export function nextLink(linkHeader) {
  if (!linkHeader) return null;
  const part = linkHeader.split(',').find((s) => s.includes('rel="next"'));
  const m = part && part.match(/<([^>]+)>/);
  return m ? m[1] : null;
}

// Authenticated GET returning { data, link }. Throws on non-2xx with a hint that
// distinguishes rate limits (403) from missing repos/branches (404).
export async function githubFetch(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'api.github.com') {
    throw new Error(`githubFetch: rejected non-GitHub URL (${parsed.hostname})`);
  }
  const res = await fetch(url, { headers: authedHeaders(), signal: timeoutSignal() });
  if (!res.ok) {
    let hint = '';
    if (res.status === 403) {
      hint = resolveToken().token
        ? ' (GitHub rate limit reached even at 5000/h - resets within the hour, try again shortly)'
        : ' (rate limit - run `gh auth login` for 5000/h)';
    }
    if (res.status === 404) hint = ' (repo or branch not found)';
    throw new Error(`GitHub ${res.status} ${res.statusText}${hint}: ${url}`);
  }
  return { data: await res.json(), link: res.headers.get('link') };
}

// Single GET against the REST API; returns parsed JSON (throws on non-2xx, e.g. 404).
export async function apiJson(path) {
  const { data } = await githubFetch(`https://api.github.com/${path}`);
  return data;
}
