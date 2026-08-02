// Server credential for state-changing /api routes (X-Forge-Token or Bearer).
// Local: auto-generated file token injected into the HTML shell. Hosted: set
// UWP_FORGE_TOKEN in the environment (required before UWP_BIND leaves loopback).
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { dirname, join } from 'node:path';
import { cookiePath } from './connectors/wporg-cookie.mjs';

function tokenPath() {
  return join(dirname(cookiePath()), 'server-token');
}

let cached = null;

export function getServerToken() {
  if (cached) return cached;
  const env = (process.env.UWP_FORGE_TOKEN || '').trim();
  if (env) {
    cached = env;
    return cached;
  }
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
  if (!got || got.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
  } catch {
    return false;
  }
}
