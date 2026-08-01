// Loopback server credential. Every state-changing /api route requires this token
// (X-Forge-Token header). The browser bundle reads it from window.__FORGE_TOKEN__,
// which the HTML shell injects on /. Non-browser callers (curl, other local
// processes) cannot mutate Forge without reading the token file first.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { cookiePath } from './connectors/wporg-cookie.mjs';

function tokenPath() {
  return join(dirname(cookiePath()), 'server-token');
}

let cached = null;

export function getServerToken() {
  if (cached) return cached;
  const p = tokenPath();
  if (existsSync(p)) {
    cached = readFileSync(p, 'utf8').trim();
    return cached;
  }
  mkdirSync(dirname(p), { recursive: true });
  cached = randomBytes(32).toString('hex');
  writeFileSync(p, cached + '\n', { mode: 0o600 });
  return cached;
}

export function requiresServerAuth(req) {
  return req.method !== 'GET' && req.method !== 'HEAD';
}

export function verifyServerAuth(req) {
  const expected = getServerToken();
  const got = req.headers['x-forge-token']
    || String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return got === expected;
}
