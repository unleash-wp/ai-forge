// Core connector: GitHub OAuth Device Flow. It powers the one-click "Sign in with GitHub"
// that replaces pasting a personal access token. It fills the *same* token store
// as a pasted token (saveToken), so everything downstream (resolveToken /
// githubFetch / rate limit) is unchanged. Zero-dependency (global fetch).
//
// Needs a GitHub OAuth App (org-owned) with **Device Flow enabled**; its client_id
// is public by design (safe to commit). Set FORGE_GITHUB_CLIENT_ID, or fill
// CLIENT_ID below. No scope is requested. Public repos are readable without one;
// the token only lifts the API rate limit 60 → 5000/h and stays read-only.
import { saveToken } from './github-token.mjs';

// The org OAuth App's client_id (public by design; device flow has no secret).
// FORGE_GITHUB_CLIENT_ID overrides it for forks / self-hosting.
const CLIENT_ID = (process.env.FORGE_GITHUB_CLIENT_ID || 'Ov23liR8yOFK3rbNkXI4').trim();

const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';

// Is one-click sign-in available on this build? Drives whether the UI shows it.
export function deviceFlowConfigured() { return !!CLIENT_ID; }

// One active flow per process (a local, single-user tool). The device_code is a
// poll ticket that must not reach the browser/model, so it lives here server-side.
let active = null;

async function ghPost(url, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  return res.json();
}

// Begin: ask GitHub for a user code. Returns only what the UI shows the user
// (never the device_code).
export async function startDeviceFlow() {
  if (!CLIENT_ID) return { error: 'GitHub sign-in is not configured on this build.' };
  const d = await ghPost(DEVICE_CODE_URL, { client_id: CLIENT_ID, scope: '' });
  if (d.error) return { error: d.error_description || d.error };
  active = { device_code: d.device_code, interval: d.interval || 5, expires: Date.now() + (d.expires_in || 900) * 1000 };
  return { user_code: d.user_code, verification_uri: d.verification_uri, interval: active.interval, expires_in: d.expires_in };
}

// Poll once. The token exchange + store (saveToken) happen server-side; the token
// is NEVER returned. Returns a status the UI can act on.
export async function pollDeviceFlow() {
  if (!active) return { status: 'idle' };
  if (Date.now() > active.expires) { active = null; return { status: 'expired' }; }
  const d = await ghPost(TOKEN_URL, {
    client_id: CLIENT_ID,
    device_code: active.device_code,
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
  });
  if (d.access_token) { saveToken(d.access_token); active = null; return { status: 'connected' }; }
  if (d.error === 'authorization_pending') return { status: 'pending' };
  if (d.error === 'slow_down') { active.interval += 5; return { status: 'pending', interval: active.interval }; }
  if (d.error === 'expired_token') { active = null; return { status: 'expired' }; }
  if (d.error === 'access_denied') { active = null; return { status: 'denied' }; }
  active = null;
  return { status: 'error', message: d.error_description || d.error || 'device flow failed' };
}
