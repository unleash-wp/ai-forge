import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveListen,
  isPublicBind,
  isAllowedHost,
  assertPublicBindSafe,
  parseAllowedHosts,
} from '../src/server-bind.mjs';

test('resolveListen defaults to loopback 4321', () => {
  const prev = { PORT: process.env.PORT, UWP_BIND: process.env.UWP_BIND };
  delete process.env.PORT;
  delete process.env.UWP_BIND;
  try {
    assert.deepEqual(resolveListen({}), { host: '127.0.0.1', port: 4321 });
    assert.deepEqual(resolveListen({ port: 9000 }), { host: '127.0.0.1', port: 9000 });
  } finally {
    if (prev.PORT === undefined) delete process.env.PORT; else process.env.PORT = prev.PORT;
    if (prev.UWP_BIND === undefined) delete process.env.UWP_BIND; else process.env.UWP_BIND = prev.UWP_BIND;
  }
});

test('resolveListen reads PORT and UWP_BIND from the environment', () => {
  const prev = { PORT: process.env.PORT, UWP_BIND: process.env.UWP_BIND };
  process.env.PORT = '8080';
  process.env.UWP_BIND = '0.0.0.0';
  try {
    assert.deepEqual(resolveListen({ port: 4321 }), { host: '0.0.0.0', port: 8080 });
  } finally {
    if (prev.PORT === undefined) delete process.env.PORT; else process.env.PORT = prev.PORT;
    if (prev.UWP_BIND === undefined) delete process.env.UWP_BIND; else process.env.UWP_BIND = prev.UWP_BIND;
  }
});

test('isPublicBind treats public addresses as public and all loopback addresses as local', () => {
  assert.equal(isPublicBind('127.0.0.1'), false);
  assert.equal(isPublicBind('127.0.0.2'), false);
  assert.equal(isPublicBind('localhost'), false);
  assert.equal(isPublicBind('app.localhost'), false);
  assert.equal(isPublicBind('0:0:0:0:0:0:0:1'), false);
  assert.equal(isPublicBind('0.0.0.0'), true);
  assert.equal(isPublicBind('::'), true);
});

test('isAllowedHost accepts loopback names and configured deployment hosts', () => {
  const req = (host) => ({ headers: { host } });
  assert.equal(isAllowedHost(req('localhost:4321')), true);
  assert.equal(isAllowedHost(req('127.0.0.1:8080')), true);
  assert.equal(isAllowedHost(req('127.0.0.2:8080')), true);
  assert.equal(isAllowedHost(req('127.evil.example'), ['forge.example.com']), false);
  assert.equal(isAllowedHost(req('evil.example'), ['forge.example.com']), false);
  assert.equal(isAllowedHost(req('forge.example.com'), ['forge.example.com']), true);
});

test('assertPublicBindSafe refuses public bind without hosted user authentication', () => {
  const prev = {
    UWP_FORGE_TOKEN: process.env.UWP_FORGE_TOKEN,
    UWP_ALLOWED_HOSTS: process.env.UWP_ALLOWED_HOSTS,
  };
  delete process.env.UWP_FORGE_TOKEN;
  delete process.env.UWP_ALLOWED_HOSTS;
  try {
    assert.throws(
      () => assertPublicBindSafe({ host: '0.0.0.0', port: 8080 }),
      /public browser hosting is not supported/,
    );
  } finally {
    if (prev.UWP_FORGE_TOKEN === undefined) delete process.env.UWP_FORGE_TOKEN;
    else process.env.UWP_FORGE_TOKEN = prev.UWP_FORGE_TOKEN;
    if (prev.UWP_ALLOWED_HOSTS === undefined) delete process.env.UWP_ALLOWED_HOSTS;
    else process.env.UWP_ALLOWED_HOSTS = prev.UWP_ALLOWED_HOSTS;
  }
});

test('assertPublicBindSafe refuses public bind even when the legacy bearer-token config is complete', () => {
  const prev = {
    UWP_FORGE_TOKEN: process.env.UWP_FORGE_TOKEN,
    UWP_ALLOWED_HOSTS: process.env.UWP_ALLOWED_HOSTS,
  };
  process.env.UWP_FORGE_TOKEN = 'test-secret';
  process.env.UWP_ALLOWED_HOSTS = 'forge.example.com';
  try {
    assert.throws(
      () => assertPublicBindSafe({ host: '0.0.0.0', port: 8080 }),
      /public browser hosting is not supported/,
    );
  } finally {
    if (prev.UWP_FORGE_TOKEN === undefined) delete process.env.UWP_FORGE_TOKEN;
    else process.env.UWP_FORGE_TOKEN = prev.UWP_FORGE_TOKEN;
    if (prev.UWP_ALLOWED_HOSTS === undefined) delete process.env.UWP_ALLOWED_HOSTS;
    else process.env.UWP_ALLOWED_HOSTS = prev.UWP_ALLOWED_HOSTS;
  }
});

test('parseAllowedHosts retains configured host names for the host-header guard', () => {
  const prev = process.env.UWP_ALLOWED_HOSTS;
  process.env.UWP_ALLOWED_HOSTS = 'forge.example.com';
  try {
    assert.deepEqual(parseAllowedHosts(), ['forge.example.com']);
  } finally {
    if (prev === undefined) delete process.env.UWP_ALLOWED_HOSTS;
    else process.env.UWP_ALLOWED_HOSTS = prev;
  }
});

// ── Public read-only hosting ────────────────────────────────────────────────
// The mode that makes the browser UI hostable. Three signals, because two of
// them get set by anyone wiring up a deployment; the third is the decision.

test('isHostedReadOnly needs all three signals, not two', async () => {
  const { isHostedReadOnly } = await import('../src/server-bind.mjs');
  const prev = {
    UWP_PUBLIC_READONLY: process.env.UWP_PUBLIC_READONLY,
    UWP_FORGE_TOKEN: process.env.UWP_FORGE_TOKEN,
    UWP_ALLOWED_HOSTS: process.env.UWP_ALLOWED_HOSTS,
  };
  const restore = () => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  };
  try {
    // SILENCE: the legacy pair alone stays refused, same as the test above pins.
    delete process.env.UWP_PUBLIC_READONLY;
    process.env.UWP_FORGE_TOKEN = 'test-secret';
    process.env.UWP_ALLOWED_HOSTS = 'forge.example.com';
    assert.equal(isHostedReadOnly(), false);

    // BELL: each missing piece keeps it off.
    process.env.UWP_PUBLIC_READONLY = '1';
    delete process.env.UWP_FORGE_TOKEN;
    assert.equal(isHostedReadOnly(), false, 'no token');

    process.env.UWP_FORGE_TOKEN = 'test-secret';
    delete process.env.UWP_ALLOWED_HOSTS;
    assert.equal(isHostedReadOnly(), false, 'no allowed hosts');

    // All three: on.
    process.env.UWP_ALLOWED_HOSTS = 'forge.example.com';
    assert.equal(isHostedReadOnly(), true);
  } finally {
    restore();
  }
});

test('assertPublicBindSafe allows a public bind only in read-only hosted mode', async () => {
  const { assertPublicBindSafe: assertSafe } = await import('../src/server-bind.mjs');
  const prev = {
    UWP_PUBLIC_READONLY: process.env.UWP_PUBLIC_READONLY,
    UWP_FORGE_TOKEN: process.env.UWP_FORGE_TOKEN,
    UWP_ALLOWED_HOSTS: process.env.UWP_ALLOWED_HOSTS,
  };
  try {
    process.env.UWP_PUBLIC_READONLY = '1';
    process.env.UWP_FORGE_TOKEN = 'test-secret';
    process.env.UWP_ALLOWED_HOSTS = 'forge.example.com';
    assertSafe({ host: '0.0.0.0', port: 8080 }); // must not throw

    // BELL: drop the decision flag and the blanket refusal returns.
    delete process.env.UWP_PUBLIC_READONLY;
    assert.throws(
      () => assertSafe({ host: '0.0.0.0', port: 8080 }),
      /public browser hosting is not supported/,
    );
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
});
