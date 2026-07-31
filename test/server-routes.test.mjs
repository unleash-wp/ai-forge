/**
 * The server actually answers.
 *
 * Nothing in this suite touched src/server.mjs before, and it cost a real
 * defect: three functions moved into their own module and the import was never
 * added. ESM resolves imports at load time but only binds identifiers when the
 * code runs, so the module loaded cleanly, every unit test passed, and the
 * ReferenceError waited for the first person to open the plugin list.
 *
 * These tests hit the routes that read the disabled-tools state. They are
 * deliberately shallow. A route that answers at all is what was missing.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { startServer } from '../src/server.mjs';

// Port 0 lets the OS pick a free one, so a developer running the app on 4321
// does not fail this suite.
const server = startServer({ port: 0, quiet: true });
const base = await new Promise((resolve) => {
  server.on('listening', () => resolve(`http://127.0.0.1:${server.address().port}`));
});

after(() => server.close());

test('GET /api/plugins answers, which means readDisabled() resolved', async () => {
  const res = await fetch(`${base}/api/plugins`);
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.ok(Array.isArray(body.plugins), 'plugins is a list');
  // Every entry carries the flag the route derives from the disabled set. If the
  // helper were unresolved this route would have thrown instead of answering.
  for (const p of body.plugins) {
    assert.equal(typeof p.enabled, 'boolean', `${p.id} has an enabled flag`);
  }
});

test('the cross-site guard refuses a state-changing request from another origin', async () => {
  const res = await fetch(`${base}/api/plugins/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://attacker.example' },
    body: JSON.stringify({ id: 'changelog', enabled: false }),
  });

  assert.equal(res.status, 403);
  assert.match((await res.json()).error, /cross-site/);
});

// Raw http, not fetch: undici derives Host from the URL and ignores an override,
// so a fetch-based version of this test would prove nothing about the guard.
test('a request addressed to a non-local host is refused before any handler', async () => {
  const { port } = server.address();
  const { statusCode, body } = await new Promise((resolve, reject) => {
    const req = httpRequest(
      { host: '127.0.0.1', port, path: '/api/plugins', headers: { Host: 'rebound.example' } },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
      },
    );
    req.on('error', reject);
    req.end();
  });

  assert.equal(statusCode, 403);
  assert.match(JSON.parse(body).error, /invalid host/);
});
