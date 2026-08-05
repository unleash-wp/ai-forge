/**
 * Public read-only hosting, proven against a running server.
 *
 * Two properties decide whether AI Forge can face the internet at all, and
 * neither is checkable by reading the config:
 *
 *   1. The HTML shell must not carry the server token. Local, it is injected on
 *      purpose so the bundle can call mutating routes. Hosted, that same line
 *      hands /api/plugins/install -- code execution inside this process -- to
 *      anyone who views source.
 *   2. Mutating routes must be refused outright, not merely gated on the token.
 *      "The secret did not leak" is a hope; refusing the whole method class is
 *      a property.
 *
 * The environment is set before importing server.mjs, because the guard is read
 * per request but the shell is built from module-level imports.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.UWP_PUBLIC_READONLY = '1';
process.env.UWP_FORGE_TOKEN = 'hosted-test-secret-do-not-ship';
process.env.UWP_ALLOWED_HOSTS = 'forge.example.com';

const { startServer } = await import('../src/server.mjs');

const server = startServer({ bind: { host: '127.0.0.1', port: 0 }, quiet: true });
const base = await new Promise((resolve) => {
  server.on('listening', () => resolve(`http://127.0.0.1:${server.address().port}`));
});

after(() => {
  server.close();
  delete process.env.UWP_PUBLIC_READONLY;
  delete process.env.UWP_FORGE_TOKEN;
  delete process.env.UWP_ALLOWED_HOSTS;
});

test('BELL: the hosted shell does not contain the server token', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  const html = await res.text();

  assert.ok(html.includes('<div id="root">'), 'the shell still renders');
  assert.ok(!html.includes('__FORGE_TOKEN__'), 'no token variable in the page');
  assert.ok(
    !html.includes('hosted-test-secret-do-not-ship'),
    'the secret itself never appears in the response body',
  );
});

test('BELL: a mutating route is refused even WITH the correct token', async () => {
  // The point of the whole mode: not "hard to reach", but "not there".
  const res = await fetch(`${base}/api/cache/clear`, {
    method: 'POST',
    headers: { 'X-Forge-Token': 'hosted-test-secret-do-not-ship' },
  });
  assert.equal(res.status, 403);
  const body = await res.json();
  assert.match(body.error, /read-only/);
});

test('SILENCE: reads still work, which is the entire point of hosting it', async () => {
  const res = await fetch(`${base}/api/plugins`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.plugins));
});

test('BELL: mounted under a prefix, the shell points every URL at it', async () => {
  // The proxy strips /forge before forwarding, so this server's own routing
  // never sees the prefix -- but the browser does, and an unprefixed
  // /assets/main.js would hit lumo-pro instead of Forge and 404.
  process.env.UWP_BASE_PATH = '/forge';
  try {
    const res = await fetch(`${base}/`);
    const html = await res.text();
    assert.ok(html.includes('src="/forge/assets/main.js"'), 'bundle URL is prefixed');
    assert.ok(html.includes('href="/forge/brand/bulb.svg"'), 'icon URL is prefixed');
    assert.ok(html.includes('window.__FORGE_BASE__="/forge"'), 'client learns the base');
  } finally {
    delete process.env.UWP_BASE_PATH;
  }
});

test('BELL: the shell tells the client it is read-only, so it can hide what cannot work', async () => {
  // Every action in the connector setup is a POST or DELETE the server refuses,
  // and the credentials it asks for -- a GitHub token, a wp.org cookie --
  // belong to the operator's warm-up job, not to a visitor. A hosted instance
  // reads from its own cache. Offering that form is offering something that
  // cannot submit, which reads as a broken product rather than a deliberate one.
  const res = await fetch(`${base}/`);
  const html = await res.text();
  assert.ok(html.includes('window.__FORGE_READONLY__=true'), 'the flag reaches the client');
});
